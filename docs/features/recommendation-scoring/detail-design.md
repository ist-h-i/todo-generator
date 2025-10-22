# 推薦スコア算出 詳細設計書

## ドキュメント管理

| 項目 | 内容 |
| --- | --- |
| バージョン | 0.1 |
| 作成者 | エンジニアリングチーム |
| 最終更新日 | 2024-07-09 |
| ステータス | Draft |

## 1. アーキテクチャ概要

- 推薦スコアリングはバックエンドのカード生成フローに組み込み、`RecommendationScoringService`を中心に構成する。
- スコアリングサービスはAI推論クライアント、ルールベース補助モジュール、設定リポジトリから成る。
- 推論結果はカード永続化レイヤへ書き込まれ、フロントエンドは読み取り専用で表示する。

```
[Analyze Page] --API--> [Card Creation Router] --calls--> [RecommendationScoringService]
                                             |--> [LLM Adapter]
                                             |--> [LabelCorrelationEngine]
                                             |--> [ProfileAlignmentEngine]
                                   <-score---|
```

## 2. コンポーネント設計

### 2.1 RecommendationScoringService

- 役割: 入力検証、サブスコア計算呼び出し、AI推論結果の統合、フォールバック制御。
- インターフェース:

  ```python
  class RecommendationScoringService:
      async def score(self, payload: ScoringPayload) -> ScoringResult:
          ...
  ```

- 主な処理手順:
  1. `payload`の必須項目（text, labels, profile）を検証。
  2. `LabelCorrelationEngine.calculate(payload.text, payload.labels)`で相関サブスコアを取得。
  3. `ProfileAlignmentEngine.calculate(payload.text, payload.profile)`で適合サブスコアを取得。
  4. AIモデル利用可否を判定し、利用可なら`LLMAdapter.infer(context)`を呼び出して重み補正値や説明テキストを取得。
  5. `weight_config`に基づいて最終スコアを算出し、0〜100に丸める。
  6. 失敗時はスコア0と`failure_reason`を設定して返却。

### 2.2 LabelCorrelationEngine

- 自然言語ベクトル（Google AI Embeddings等）を用いてカード本文とラベル名を比較。
- 処理:
  1. カード本文をチャンク化（最大512トークン）し、ベクトル化。
  2. 各ラベル名をベクトル化し、コサイン類似度を算出。
  3. 最大類似度を基準に0〜100へスケーリング。
  4. ラベルが存在しない場合は0を返す。

### 2.3 ProfileAlignmentEngine

- プロフィールの役割・部署・スキルタグとカードのキーワードを比較し適合度を算出。
- 処理:
  1. プロフィール側から主要スキルタグと職務カテゴリを抽出。
  2. カード本文とAI推論で抽出したキーワードをTF-IDFまたはEmbeddingでベクトル化。
  3. 役割とラベルのマッピングテーブル（設定テーブル）を参照しボーナスを加算。
  4. 適合度を0〜100へスケーリング。

### 2.4 LLMAdapter

- 推論先LLMを抽象化。`responses.create`互換のGoogle AIクライアントを想定。
- 入出力:
  - 入力: スコアリングコンテキスト（カード本文、上位ラベル類似度、プロフィールサマリ）。
  - 出力: 説明文、重み補正、追加フィーチャ値。
- 例外時は`LLMInferenceError`を送出し、サービス層がフォールバックを実施。

### 2.5 WeightConfigRepository

- 環境変数・設定DBを参照し、重みや閾値を提供。
- キャッシュ層を併用し、リクエストごとに再読み込みせず10分間有効とする。

## 3. データモデル

```python
@dataclass
class ScoringPayload:
    card_id: UUID | None
    text: str
    labels: list[str]
    profile: UserProfileSnapshot

@dataclass
class ScoringResult:
    score: int  # 0-100
    label_correlation: float
    profile_alignment: float
    explanation: str
    failure_reason: str | None
    model_metadata: ModelMetadata | None
```

- `UserProfileSnapshot`は既存の分析フローと同一形式を再利用する。
- `ModelMetadata`にはモデル名、バージョン、応答トークン数などを格納。

## 4. シーケンスフロー

1. フロントエンドがカード生成APIを呼び出す。
2. ルータが認証情報から`UserProfileSnapshot`を生成し`ScoringPayload`を構築。
3. `RecommendationScoringService.score`がサブモジュールを呼び出してサブスコアを計算。
4. 必要に応じてLLM推論を行い、説明テキストや補正係数を取得。
5. 最終スコアを算出して`ScoringResult`として返却。
6. 永続化レイヤがスコアと説明、失敗フラグをカードレコードに保存。
7. レスポンスとしてクライアントに`ai_confidence`と説明文を格納した`ai_notes`を返却。

## 5. スコア算出ロジック

- 基本式: `score = clamp(0, 100, round(label_score * w_label + profile_score * w_profile + bias))`
- `bias`はLLM推論が返す補正値。推論失敗時は0。
- ラベルスコア、プロフィールスコアはともに0〜100で正規化する。
- LLMが返す補正値は-20〜+20の範囲で制限。
- 推論失敗時:
  - `score = 0`
  - `failure_reason = "llm_unavailable"`等のコードを設定。
  - `explanation`にはフォールバックメッセージを格納。

## 6. エラーハンドリングと再試行

- サブスコア計算での例外はログ出力後、フォールバック値0を適用し処理継続。
- LLM推論が`retryable`と判定される場合（ネットワークタイムアウトなど）は指数バックオフで最大2回再試行。
- 非リトライエラー（認証エラー等）は即時フォールバック。
- すべてのエラーは`ScoringTelemetry`にイベントとして送出し、監視基盤に集約する。

## 7. 設定と運用

- `RECOMMENDATION_WEIGHT_LABEL`, `RECOMMENDATION_WEIGHT_PROFILE`環境変数でウェイト調整。
- `RECOMMENDATION_SCORE_TIMEOUT_MS`で推論タイムアウトを指定（デフォルト300ms）。
- 設定値はSecrets Manager／設定DBに格納し、サービス起動時に読み込む。
- 運用時は以下のメトリクスをPrometheusへ出力:
  - `recommendation_score_latency_ms`
  - `recommendation_score_failure_total`
  - `recommendation_label_similarity`
  - `recommendation_profile_alignment`

## 8. テレメトリと監査

- 推論成功時にはモデル名、推定スコア、サブスコア、補正値をJSONで監査テーブルへ記録（PIIはハッシュ化）。
- UIからのスコア参照イベントはフロントエンド分析SDKで計測し、バックエンドの推論イベントと相関分析できるようにする。
- 14日を超えるデータは集約のみ保持し、生データは削除する。

## 9. 今後の拡張余地

- 採択／却下履歴をオンライン学習フィードバックとして利用し、ウェイトや補正値を自動調整する仕組みを導入可能。
- チーム単位でのカスタム特徴量（例: スプリント目標、ロードマップの優先度）を追加し、スコアの多次元化を行う。
- 説明テキストを多言語化し、UI側でユーザ言語設定に応じた表示を提供する。
