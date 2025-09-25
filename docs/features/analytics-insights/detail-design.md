# Analytics & Continuous Improvement 詳細設計

## 1. 目的
Analytics & Continuous Improvement は、カードボードの絞り込みから管理者向けの分析・改善ダッシュボードまでを横断的に支える機能群です。保存フィルターやスナップショット、Why-Why 分析、提案アクション、イニシアチブ管理を連携させ、AI が生成するレポート草案まで一貫して提供します。【F:frontend/src/app/features/analytics/page.ts†L1-L112】【F:backend/app/routers/analytics.py†L1-L200】

## 2. コンポーネント概要
- **WorkspaceStore** – カード・ラベル・ステータスを Signal ベースで保持し、フィルターやグルーピングをローカルストレージに同期します。【F:frontend/src/app/core/state/workspace-store.ts†L1-L200】
- **BoardPage** – クイックフィルター、カードグルーピング、ドラッグ＆ドロップを提供し、WorkspaceStore の状態を UI にマッピングします。【F:frontend/src/app/features/board/page.ts†L1-L160】
- **ContinuousImprovementStore** – 分析スナップショット、原因ツリー、提案アクション、イニシアチブ、レポート草案を統合的に管理します。【F:frontend/src/app/core/state/continuous-improvement-store.ts†L1-L200】
- **Analytics Router** – スナップショット CRUD と Why-Why 分析生成、提案アクション展開、イニシアチブ更新を行います。【F:backend/app/routers/analytics.py†L16-L200】
- **Filters Router** – 保存フィルターの CRUD を提供し、ユーザー単位でアクセス制御します。【F:backend/app/routers/filters.py†L1-L78】
- **SQLAlchemy モデル** – `AnalyticsSnapshot`、`RootCauseAnalysis`、`RootCauseNode`、`SuggestedAction`、`ImprovementInitiative`、`InitiativeProgressLog` が継続的改善データを保持します。【F:backend/app/models.py†L301-L439】

## 3. ボードフィルタリング設計
WorkspaceStore はフィルター・グルーピング・テンプレート設定を `signal` で保持し、変化時にボード列やサマリーメトリクスを再計算します。クイックフィルターは定義済み ID をマップし、選択に応じた説明文を UI に提供します。【F:frontend/src/app/core/state/workspace-store.ts†L83-L160】【F:frontend/src/app/features/board/page.ts†L29-L145】
保存フィルターは `/filters` API と連携し、作成者以外のアクセスは 404 で遮断されます。【F:backend/app/routers/filters.py†L33-L78】

## 4. Analytics API フロー
### 4.1 スナップショット
管理者は `/analytics/snapshots` に対して期間・メトリクス・ナラティブを送信し、レコードが作成されます。クエリ時には `period_start` / `period_end` で重なり期間をフィルタリングします。【F:backend/app/routers/analytics.py†L16-L64】スナップショットはメトリクス JSON、ナラティブ、生成者情報を保存します。【F:backend/app/models.py†L301-L318】

### 4.2 Why-Why 分析
`POST /analytics/{target}/why-why` では対象となるスナップショット/カードを解決し、原因ノードと提案アクションを生成して保存します。【F:backend/app/routers/analytics.py†L65-L200】ノードは深さ・信頼度・証拠・推奨メトリクスを保持し、提案アクションはタイトル・説明・労力・インパクト・担当ロール・期限候補を含みます。【F:backend/app/models.py†L318-L427】提案アクションは追加ヒントから最大 2 件の追加アクションを派生させます。【F:backend/app/routers/analytics.py†L80-L163】

### 4.3 イニシアチブ
`ImprovementInitiative` は提案アクションと関連し、進捗ログを持ちます。Why-Why 分析からカードを起票すると、進捗にイベントが追加されます。【F:backend/app/models.py†L332-L364】【F:frontend/src/app/core/state/continuous-improvement-store.ts†L148-L200】

## 5. フロントエンドダッシュボード
AnalyticsPage は WorkspaceStore と ContinuousImprovementStore を統合し、ステータス・ラベルの枚数、ストーリーポイント合計、スナップショット情報、原因ツリー、提案アクション、レポート草案を描画します。【F:frontend/src/app/features/analytics/page.ts†L1-L112】提案アクションのカード化やスナップショット切り替えは Store のメソッドを呼び出し、Signals を通じて UI を即時更新します。【F:frontend/src/app/core/state/continuous-improvement-store.ts†L75-L200】

## 6. レポート草案生成
ContinuousImprovementStore はユーザー入力の指示文を保持し、選択中のスナップショットや原因ノード、提案アクションをテンプレート化して Markdown ベースのレポート草案を生成します。スナップショットを切り替えると自動的に草案を再構築します。【F:frontend/src/app/core/state/continuous-improvement-store.ts†L130-L147】

## 7. データモデル
| モデル | 主要フィールド |
| --- | --- |
| `AnalyticsSnapshot` | `period_start`, `period_end`, `metrics`, `narrative`, `generated_by`【F:backend/app/models.py†L301-L318】 |
| `RootCauseAnalysis` | `target_type`, `version`, `status`, `summary`, `nodes`, `suggestions`【F:backend/app/models.py†L318-L363】 |
| `RootCauseNode` | `depth`, `statement`, `confidence`, `state`, `recommended_metrics`【F:backend/app/models.py†L363-L381】 |
| `SuggestedAction` | `title`, `description`, `effort_estimate`, `impact_score`, `owner_role`, `due_date_hint`, `status`, `initiative_id`, `created_card_id`【F:backend/app/models.py†L381-L427】 |
| `ImprovementInitiative` | `status`, `health`, `progress_logs`, `suggested_actions`【F:backend/app/models.py†L332-L364】 |

## 8. セキュリティとアクセス制御
Analytics ルーターは管理者専用ガード `require_admin` を依存関係として利用し、一般ユーザーからのアクセスを拒否します。【F:backend/app/routers/analytics.py†L16-L32】保存フィルターは作成者 ID によるチェックで不正アクセスを防ぎます。【F:backend/app/routers/filters.py†L33-L78】

## 9. テレメトリ
- スナップショット作成・更新はイベントログに記録され、期間別の利用率や失敗率を監視します。
- 提案アクションのカード化時には `created_card_id` が保存されるため、転換率とリードタイムの算出が可能です。【F:backend/app/models.py†L381-L427】
- フロントでは Signals の更新を活用し、ユーザー行動を analytics SDK で計測できるようセクション分割しています。【F:frontend/src/app/features/analytics/page.ts†L65-L112】

## 10. テスト戦略
- **ユニットテスト** – WorkspaceStore/ContinuousImprovementStore の状態変換、フィルター復元、レポート生成ロジックを検証。
- **API テスト** – `/filters` と `/analytics` の CRUD、期間フィルタ、Why-Why 生成、提案アクション派生、アクセス制御を網羅。
- **エンドツーエンドシナリオ** – スナップショット選択から提案アクションカード化、レポート草案更新までを UI 経由で確認。
