# 永続化処理 詳細設計

## 目的とスコープ
ワークスペースの主要操作（ボード管理、継続的改善、レポート、プロフィール／ガバナンス、コンピテンシー評価）で現状フロントエンドのみで完結している処理を、FastAPI バックエンドに永続化させるための詳細設計をまとめる。カード一覧と提案カード作成のみが `CardsApiService` 経由で `/cards` に連携され、それ以外は `WorkspaceStore` が Signal とローカルストレージで完結しているのが現状である。コメント／サブタスク編集、ボード設定、フィルター、継続的改善ダッシュボードなどはすべてクライアント側で mutate している。【F:frontend/src/app/core/api/cards-api.service.ts†L83-L107】【F:frontend/src/app/core/state/workspace-store.ts†L1073-L1545】【F:frontend/src/app/core/state/workspace-store.ts†L2148-L2249】

本設計は以下の操作に対して永続化方式を定義する。

- ボード上のカード／サブタスク／コメント編集、ドラッグ＆ドロップ操作、手動アクティビティログ
- ボード設定（列幅・グルーピング・フィルター／テンプレート・ラベル／ステータス／エラーカテゴリ管理）
- 継続的改善ダッシュボード（スナップショット・イニシアチブ・提案アクション）
- レポート／AI ワークフロー（ステータスレポート、アピール生成）
- プロフィール／ガバナンス設定（プロフィール、管理者 API 資格情報・クォータ設定）
- コンピテンシー評価（定義、自己評価実行）

## 現状のデータソースと制約
- FastAPI 側にはカード／サブタスク／コメント／活動ログ／ボードレイアウト／保存済みフィルターなどのモデルと REST ルーターが既に用意されている。【F:backend/app/models.py†L120-L260】【F:backend/app/routers/cards.py†L203-L563】【F:backend/app/routers/comments.py†L1-L139】【F:backend/app/routers/activity.py†L1-L76】【F:backend/app/routers/preferences.py†L1-L33】【F:backend/app/routers/filters.py†L15-L104】
- 継続的改善ストアは `continuous-improvement-fixtures` のスタブを Signal に読み込んでおり、AI 変換時のみカード作成 API を叩いている。【F:frontend/src/app/core/state/continuous-improvement-store.ts†L1-L139】【F:frontend/src/app/core/state/continuous-improvement-fixtures.ts†L1-L79】
- 分析ルーター・ステータスレポート・プロフィール・管理者機能・コンピテンシー評価はバックエンドに CRUD が存在し、Angular サービスで利用済みの領域もある。【F:backend/app/routers/analytics.py†L1-L200】【F:backend/app/routers/status_reports.py†L1-L117】【F:backend/app/routers/profile.py†L22-L67】【F:backend/app/routers/admin_settings.py†L1-L140】【F:backend/app/routers/competency_evaluations.py†L61-L185】

## 永続化設計
### 1. ボード／タスク管理
#### 1-1. カードとサブタスク CRUD
- API サーフェス: `/cards` (GET/POST/PUT/DELETE) および `/cards/{card_id}/subtasks` (GET/POST/PUT/DELETE)。【F:backend/app/routers/cards.py†L203-L563】
- フロント実装: `CardsApiService` に update/delete、`SubtasksApiService` 相当のメソッドを追加する。`WorkspaceStore` は各 mutate メソッドで API 呼び出しを行い、成功レスポンスでローカル状態を再計算する。失敗時はロールバック（楽観ロック: API 応答前は UI 先行更新し、エラー時に再フェッチ）。
- 追加バリデーション: `WorkspaceStore` の入力サニタイズを継続しつつ、API エラーをトースト表示。ドラッグ＆ドロップ（`updateCardStatus`）は `PATCH /cards/{id}` で status_id を送信し、`completed_at` 更新はバックエンド側で `_status_is_done` に準じて計算する。【F:backend/app/routers/cards.py†L36-L125】【F:frontend/src/app/core/state/workspace-store.ts†L1073-L1182】

#### 1-2. コメントとアクティビティ
- API サーフェス: `/comments` (list/create/update/delete) と `/activity-log` (list/create)。【F:backend/app/routers/comments.py†L24-L139】【F:backend/app/routers/activity.py†L12-L76】
- フロント実装: コメント用に `CommentsApiService` を新設し、`WorkspaceStore.addComment/updateComment/removeComment` で呼び出す。成功時のレスポンスで `comment.id` を同期し、`record_activity` による履歴も `/activity-log` GET で表示する。手動アクティビティログ入力 UI を追加する場合は `ActivityApiService.create` を利用し、`details` に任意メタデータを格納する。
- キャッシュ戦略: コメント／アクティビティはカード詳細を開いたタイミングでフェッチし、Signal にキャッシュする。更新後は差分適用しつつ 5 分程度で自動再フェッチするポリシーを採用。

#### 1-3. ボード設定・フィルター
- API サーフェス: `/board-layouts` で `UserPreference` を永続化、`/saved-filters` でフィルター CRUD。【F:backend/app/routers/preferences.py†L10-L33】【F:backend/app/routers/filters.py†L15-L104】
- フロント実装: `WorkspaceStore.persistSettings`／`persistPreferencesState` のローカルストレージ書き込みを API 呼び出しに置換。`BoardLayoutUpdate` に列幅／表示フィールド／通知設定を詰め、成功レスポンスを Signal に反映する。保存済みフィルター UI では `/saved-filters` の共有フラグやクエリ条件を操作するフォームを実装。
- 移行: 初回アクセス時にローカルストレージの旧データを読み込み、API POST/PATCH に同期したのちローカル値を削除。マイグレーション処理は `migrateLegacySettings` ロジックを活かし API 送信後に `removeItem` を実施する。【F:frontend/src/app/core/state/workspace-store.ts†L2148-L2249】

#### 1-4. ワークスペース設定（ステータス／ラベル／エラーカテゴリ）
- API サーフェス: `/statuses`, `/labels`, `/error-categories`。対応するモデルは `models.Status`／`models.Label`／`models.ErrorCategory` に存在する。【F:backend/app/models.py†L170-L236】
- フロント実装: 既存の設定編集 UI（`WorkspaceStore` の mutate 群）を API クライアントでラップし、CRUD 後に `WorkspaceStore.settingsSignal` を再フェッチして整合性を保つ。参照データは `GET` 応答をキャッシュし、カード作成フォームにバインドする。

### 2. 継続的改善・分析
- API サーフェス: `/analytics/snapshots`, `/analytics/root-causes`, `/analytics/suggestions`, `/improvement-initiatives` 等。【F:backend/app/routers/analytics.py†L1-L200】【F:backend/app/models.py†L237-L439】
- フロント実装: `ContinuousImprovementStore` の初期値を fixture ではなく API フェッチに差し替え、Signal 初期化時に `GET` 結果を保持。提案アクションの状態遷移（`convertSuggestedAction` 等）は `/analytics/suggestions/{id}` PATCH、進捗ログ追記は `/improvement-initiatives/{id}/progress` POST を使用する。
- キャッシュ／ポーリング: スナップショットは日次更新想定のためアプリ起動時にフェッチ、進捗ログは編集画面での mutate ごとに再取得。AI 生成結果は既存の `AnalysisGateway` をラップし、サーバー側に結果を保存する Webhook 連携を将来的に検討。

### 3. レポート／AI ワークフロー
- API サーフェス: `/status-reports` 系、`/appeals`（新設予定）。【F:backend/app/routers/status_reports.py†L1-L117】
- フロント実装: 現在の `StatusReportsGateway` 呼び出しを踏襲しつつ、下書き保存や送信失敗の再実行を API レスポンスのステータスで制御。アピール生成については FastAPI に `/appeals` ルーターを追加し、生成リクエスト・履歴取得・テンプレート管理を CRUD として設計する（OpenAI 呼び出しのキューイングはステータスレポート実装を再利用）。
- 非同期処理: レポート送信／アピール生成はバックグラウンドタスクまたはキュー（RQ / Celery）で非同期化し、フロントはポーリングまたは Server-Sent Events で進捗を追跡する設計とする。

### 4. プロフィール／ガバナンス
- API サーフェス: `/profile/me`, `/admin/api-credentials`, `/admin/quotas`, `/admin/users` など既存ルーターを活用。【F:backend/app/routers/profile.py†L22-L67】【F:backend/app/routers/admin_settings.py†L1-L140】
- フロント実装: `ProfileService` は既に `/profile/me` を利用済みなので、自己紹介・アバター更新フォームで API レスポンスをそのまま Signal に取り込む。管理者 UI はテーブル編集時に対応する `AdminApiService` 呼び出しを行い、更新後は `GET` で最新値を再取得する。
- 監査対応: 重要設定変更時は `ActivityLog` にもイベントを記録するようバックエンドを拡張し、監査証跡を一元管理する（`record_activity` 再利用）。

### 5. コンピテンシー評価
- API サーフェス: `/competencies`, `/competency-evaluations`, `/evaluation-jobs` 等。【F:backend/app/routers/competency_evaluations.py†L61-L185】
- フロント実装: `CompetencyApiService` の既存メソッドを活用し、評価定義編集と自己評価実行 UI を永続化に接続する。日次クォータ確認は `/users/me/evaluations/limits` を先行呼び出しし、許容回数を超える操作はボタン無効化。
- 履歴保持: 評価結果はバックエンドの `CompetencyEvaluation` テーブルに保存済みなので、履歴タブは API ページングレスポンスをストリーミング表示。必要であれば `evaluation_jobs` に紐づく AI ログを追加保存する設計とする。

## 同期・エラーハンドリング方針
1. **楽観的 UI 更新**: 状態遷移を即座に UI 反映し、API 失敗時はローカルコピーを保持して差分復元。失敗理由は Snackbar で表示。
2. **再フェッチ契機**: 成功レスポンスを適用後、必要に応じて一覧再取得（例: カード詳細更新後に `/cards/{id}` を再取得して正規化）。
3. **バリデーション統合**: フロントの入力サニタイズを維持しつつ、FastAPI の Pydantic バリデーションエラーを UI にマッピングする。`422` 応答はフォームエラーとして表示。
4. **ID 正規化**: フロントで暫定 ID を払い出す処理（`createId()`）は API 応答 ID に置換。ローカルで生成した ID はリトライ時の差分検出に活用。
5. **マイグレーション**: ローカルストレージのみで保持していたデータは初回 API 成功時にサーバーへ移行し、削除完了後に以降のソースを API に統一する。

## ネクストタスク提案
1. **API クライアント拡充**: `CardsApiService` の update/delete、コメント／アクティビティ／フィルター／ボード設定用サービスを追加し、Angular DI 登録とユニットテストを整備する。
2. **WorkspaceStore リファクタリング**: Signal ベースの mutate 関数を API 呼び出し対応へ書き換え、失敗時ロールバックと再フェッチ処理を実装する。Feature テスト（Jest）を追加。
3. **継続的改善 UI の API 連携**: Fixtures からの初期化を廃止し、分析／イニシアチブ／提案取得 API を呼び出す NGRX もしくは Signals 実装に差し替える。カード化フローの単体テストを更新。
4. **保存済みフィルター UI の提供**: `/saved-filters` CRUD を利用した保存・読込 UI をボードに追加し、E2E シナリオで動作検証する。
5. **アピール生成ルーター追加**: FastAPI に `/appeals` ルーターを新設し、OpenAI 連携・履歴保存・再実行を実装する。フロントのフォームとステータス表示を追加。
6. **監査ログの強化**: 管理者操作と評価実行を `ActivityLog` に記録するバックエンド拡張と、UI 上の履歴表示コンポーネントを整備する。
7. **データ移行スクリプト作成**: 既存ユーザーのローカル設定を API に同期するためのマイグレーションスクリプトとオプション CLI を用意する。

本設計により、フロントエンドで保持していた重要データがすべてサーバーサイドで一貫して管理され、将来的なマルチデバイス利用や監査要件への対応が可能になる。
