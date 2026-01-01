# Gemini API 本番統合（モック排除）バックエンド改修計画

## Document Control

| Item | Detail |
| --- | --- |
| Version | 0.1 |
| Author | Product / Engineering |
| Last Updated | 2025-12-29 |
| Status | Draft |

## 1. 目的

バックエンドに残っている「暫定（heuristic / rule-based / fallback）実装」や「ハードコードされた生成結果」を撤廃し、Gemini API を用いた実リクエストでアプリ機能を一貫して動作させる。

本ドキュメントは、改修対象の洗い出しと、実装・移行の方針（設計方針 / エラー設計 / 運用要件）をまとめる。

## 2. 現状（AI 関連機能の実装状態）

| 機能/領域 | API（代表） | 現状 | 主な実装箇所 |
| --- | --- | --- | --- |
| Analyzer（カード提案） | `POST /analysis` | Gemini 呼び出し済み | `backend/app/routers/analysis.py`, `backend/app/services/gemini.py` |
| Status report（分析/提案） | `POST /status-reports/{report_id}/submit` | Gemini 呼び出し済み | `backend/app/routers/status_reports.py`, `backend/app/services/status_reports.py` |
| Appeal generation（文章生成） | `POST /appeals/generate` | Gemini が使える場合のみ呼び出し + 失敗時/未設定時は deterministic fallback | `backend/app/routers/appeals.py`, `backend/app/services/appeals.py` |
| Recommendation scoring（カードおすすめ度） | `POST /cards`, `PATCH /cards/{id}`, `GET /cards/{id}/similar` | deterministic heuristic（LLM 未使用） | `backend/app/services/recommendation_scoring.py`, `backend/app/routers/cards.py` |
| Competency evaluation（評価生成） | `POST /users/me/evaluations` / `POST /users/me/evaluations/batch` | rule-based（LLM 未使用） | `backend/app/services/competency_evaluator.py`, `backend/app/routers/competency_evaluations.py` |
| Immunity map（免疫マップ推測/可視化） | `POST /analysis/immunity-map` | Gemini（構造化出力 + Mermaid 生成） | `backend/app/routers/analysis.py` |
| Report drafting（レポート生成） | `POST /reports/generate` | deterministic 生成（LLM 未使用） | `backend/app/routers/reports.py` |

## 3. 目標状態（To-Be）

1. AI 生成を前提とする機能は、原則として Gemini API を呼び出して生成する（暫定ロジックは段階的に削除）。
2. Gemini 未設定は `503 Service Unavailable`（依存解決時に失敗）として扱い、上流（Gemini API）の失敗は `502 Bad Gateway` とする。
3. 生成結果は JSON schema による構造化・バリデーションを必須とし、フロントエンド/DB の契約を壊さない。
4. シークレット（API key）は DB（暗号化）または環境変数で管理し、ログに残さない。
5. 生成コスト・レイテンシが大きい箇所（例: カード更新ごとのスコアリング）は、同期 API に組み込まない設計（非同期化/オンデマンド化/キャッシュ）を検討する。

## 4. 共通改修方針（アーキテクチャ）

### 4.1 Gemini 呼び出しの単一化

- Gemini 呼び出しは `backend/app/services/gemini.py` を単一窓口とし、FastAPI dependency として `get_gemini_client` を利用する。
- 追加の AI ワークフローは、次のいずれかで実装する。
  - `GeminiClient` に「用途別メソッド」を追加（例: `draft_report()`）。
  - もしくは `services/*` に用途別サービスを追加し、内部で `GeminiClient` を使用（`GeminiClient` の肥大化を避けたい場合はこちら）。

### 4.2 構造化レスポンス（JSON schema）を必須化

- 生成レスポンスは「JSON object で、追加プロパティを禁止」する設計を基本とする。
- スキーマは「API レスポンスで返す最小フィールド」を起点に設計し、DB へは validated payload のみ保存する。
- Gemini 側のスキーマ制限（未サポートキー）の吸収は既存の `_sanitize_schema` を継続利用する。

### 4.3 設定・シークレット管理

- API key は `api_credentials` テーブル（`encrypted_secret`）に保存し、`SECRET_ENCRYPTION_KEY` が未設定の場合は管理 API を `503` で失敗させる（現行仕様）。
- ローカル/CI 用のフォールバックとして `GEMINI_API_KEY` / `GOOGLE_API_KEY`（環境変数）を許容する（現行仕様）。
- モデル指定は `GEMINI_MODEL`（デフォルト）を基準とし、必要に応じて機能別オーバーライド（例: スコアリングだけ軽量モデル）を追加する。

### 4.4 エラー設計・リトライ方針

- **未設定/無効**: dependency で `503`（例: `GeminiConfigurationError` → `HTTPException(503)`）。
- **Gemini API 失敗**: `502`（例外は `GeminiError` に集約し、ルータ層で `HTTPException(502)` に変換）。
- **タイムアウト/レート制限**: まずは `502` として扱い、必要なら `429`（rate limit）への写像、またはバックオフ/再試行を導入する。
- 「fallback（疑似生成）」を残す場合は、**運用モードで明示的に OFF** にできるようにし、意図しない品質低下（偽の AI 結果の混入）を防ぐ。

### 4.5 セキュリティ（送信データの最小化）

- プロンプトへ渡すデータは最小限にし、メールアドレス・電話番号・長い数列等はマスクする（`services/appeals.py` のマスキングを他ワークフローにも横展開）。
- 生成結果は「確信度（confidence）」「根拠（rationale）」などを明示させ、捏造（fabrication）を抑制するシステムプロンプト規約を導入する。

### 4.6 観測性（トレーシング/監査）

- 可能な範囲で `model`、`token_usage`、レイテンシ、失敗理由（`*_failure_reason`）を DB に保存し、管理画面/運用で追える状態にする。
- ログには API key、トークン、個人情報、原文プロンプト全文を出さない（サマリ化/長さ制限）。

## 5. 機能別の改修方針

### 5.1 Appeal generation（`/appeals`）

現状は Gemini 未設定や失敗時に deterministic fallback を返すため、「AI を使っているつもりだが実際は固定文」の混入が起き得る。

- 方針: `get_optional_gemini_client` を廃止し、`get_gemini_client` を必須にする（未設定は `503`）。
- 生成失敗は `502` とし、UI は再試行導線を提供する。
- 既存のマスキング/HTML エスケープは継続する。

### 5.2 Recommendation scoring（カード `ai_confidence` / `ai_notes`）

`POST /cards` や `PATCH /cards/{id}` で呼ばれる処理は頻度が高く、LLM 同期呼び出しはレイテンシ・コスト・失敗影響が大きい。

- 方針案 A（推奨）: **非同期化**（作成/更新は即時応答し、バックグラウンドで Gemini スコアリング → 後から `ai_confidence` を更新）。
- 方針案 B: **オンデマンド化**（`POST /cards/{id}/score` のような明示的トリガ API を追加）。
- 生成結果のスキーマ例:
  - `score`（0-100）
  - `explanation`（日本語）
  - `subscores`（label/profile 等の任意サブスコア）
  - `failure_reason`（任意）
  - `model` / `token_usage`（任意）
- 保存先:
  - 既存の `Card.ai_confidence` / `Card.ai_notes` / `Card.ai_failure_reason` を継続利用。
  - `model` / `token_usage` の保存が必要なら、`custom_fields` へ格納するか、専用カラム/テーブル追加を検討する。

### 5.3 Competency evaluations（`/users/me/evaluations`, `/users/me/evaluations/batch`）

現状は rule-based で評価と提案を生成しており、AI 支援体験（合理的な根拠・行動提案）が弱い。

- 方針: `CompetencyEvaluator` を Gemini ベースに置き換える、または `GeminiCompetencyEvaluator` を追加して移行する。
- バッチ評価は 1 リクエストで複数コンピテンシーを判定し、日次クォータは 1 回分消費する前提とする。
- 入力コンテキスト案:
  - 評価対象期間のカード/サブタスク集計（既存のメトリクス）
  - `Competency`（level, rubric, criteria prompts）
  - ユーザプロフィール（必要最小限）
- 出力（JSON schema）案:
  - `score_value`, `score_label`, `rationale`
  - `attitude_actions`, `behavior_actions`
  - `items[]`（criterion ごとの rationale/actions）
  - `model`, `token_usage`
- ジョブ（`CompetencyEvaluationJob`）の status 遷移は維持し、失敗時は `failed` として理由を保存する。

### 5.4 Immunity map（`/analysis/immunity-map`）

旧 Analytics Why-Why を廃止し、免疫マップ（A〜F）を Gemini で推測して Mermaid で可視化する API を提供する。

- 方針: Gemini の構造化出力で B〜F とエッジを生成し、サーバ側で Mermaid を組み立てる（空要素/空エッジ/空カテゴリは出力しない）。
- 入力コンテキスト案:
  - A（やるべき/やれない/やりたい）と背景（任意）
  - 任意: 対象 snapshot/card
- 出力（JSON schema）案:
  - `payload.nodes[]` / `payload.edges[]`
  - `mermaid`, `summary`, `model`, `token_usage`

### 5.5 Report drafting（`/reports/generate`）

現状は snapshot/analysis/initiative を文字列整形して Markdown を生成しており、AI による要約・文章品質のメリットを使っていない。

- 方針: Gemini で Markdown レポートを生成する（テンプレート sections と audience 指定をプロンプトへ投入）。
- 入力コンテキスト案:
  - レポートテンプレート（sections, branding, audience）
  - snapshot metrics / immunity map summary (optional) / initiatives / free notes
- 出力（JSON schema）案:
  - `title`, `sections[]`（heading, body_markdown）
  - `content_markdown`（組み立て済み全体）
  - `model`, `token_usage`
- `GeneratedReport` に `model` / `token_usage` を保存する必要があれば、DB スキーマ拡張を行う。

## 6. 実装ステップ（推奨順）

1. **共通基盤**: Gemini 呼び出しラッパ（用途別 schema 生成、PII マスク、メトリクス記録）の方針決定。
2. **Appeal generation を strict 化**: optional/fallback の撤廃（または feature flag 化）。
3. **Competency evaluations を Gemini 化**: 生成スキーマと保存形式を確定し、ジョブ失敗時の巻き戻しを整備。
4. **Report drafting を Gemini 化**: 既存の deterministic 生成を置き換え（必要なら段階移行）。
5. **Immunity map を Gemini 化**: 免疫マップ生成スキーマ確定、UI 連携の確認。
6. **Recommendation scoring を Gemini 化**: 同期 API から切り離す設計（非同期/オンデマンド）を採用し、運用負荷を制御。

## 7. テスト/検証方針

- **Unit**: 各サービスの Gemini 呼び出しは `GeminiClient` をスタブ化し、schema バリデーション・DB 書き込み・エラー写像（502/503）を検証する。
- **Contract**: 生成 JSON schema を固定し、壊れたレスポンス（missing field / 余分な field / 型不一致）で確実に失敗することを確認する。
- **Integration（任意）**: 実キーを入れた環境で、主要フロー（analysis/immunity-map/status-reports/appeals/competency/report）を手動で通し、レート制限とコスト感を把握する。

## 8. 完了条件（Definition of Done）

- heuristic / rule-based / fallback による「生成結果の代替」が、運用モードでは無効化されている（もしくは削除済み）。
- AI 生成を行う API は、Gemini 未設定で `503`、Gemini 失敗で `502` を返す。
- 生成結果は schema バリデーションを通過したデータのみ永続化される。
- 主要な AI 生成について、`model` と（可能なら）`token_usage` が追跡できる。
