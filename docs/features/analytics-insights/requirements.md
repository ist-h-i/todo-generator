# Analytics & Continuous Improvement Requirements

## Document Control
| Field | Value |
| --- | --- |
| Version | 1.0 |
| Author | Product Strategy Team |
| Last Updated | 2024-06-30 |
| Status | Approved |

## 1. Background & Objectives
ワークスペースでは日々の改善活動がカードとして蓄積されていますが、従来のボードでは主要課題の俯瞰や因果分析、フォローアップの管理が困難でした。Analytics & Continuous Improvement 機能は、ボードのフィルタリングから根本原因分析、改善施策の追跡、レポート化までを一連の体験として提供します。【F:frontend/src/app/features/board/page.ts†L1-L160】【F:frontend/src/app/features/analytics/page.ts†L1-L112】【F:backend/app/routers/analytics.py†L1-L200】

### Objectives
1. カードボードで必要なタスクを素早く絞り込み、ストーリーポイントやステータスの傾向を可視化する。【F:frontend/src/app/core/state/workspace-store.ts†L1-L200】
2. 管理者が分析スナップショットや Why-Why 分析を作成し、根本原因と提案アクションを体系的に管理できるようにする。【F:backend/app/routers/analytics.py†L16-L200】【F:backend/app/models.py†L301-L439】
3. 改善施策の進捗やレポート草案をダッシュボードで確認し、AI 生成された要約をチームで再利用できるようにする。【F:frontend/src/app/core/state/continuous-improvement-store.ts†L1-L200】

## 2. Success Metrics
| Metric | Target | Measurement |
| --- | --- | --- |
| 保存済みフィルター再利用率 | アクティブユーザーの 60% が週 1 回以上保存済みフィルターを適用 | `filter_saved` / `filter_applied` イベント |
| 分析スナップショット活用率 | 管理者の 50% が月 1 回以上スナップショットを作成 | `/analytics/snapshots` POST ログ |
| 提案アクション転換率 | 提案アクションの 40% がカードに変換 | `SuggestedAction.created_card_id` 比率【F:backend/app/models.py†L381-L427】|
| レポート生成採用率 | ダッシュボード利用ワークスペースの 30% が月 1 回レポート草案を生成 | `report.generate` イベント |

## 3. Scope
### In Scope
- ボードのクイックフィルター、ラベル/ステータス絞り込み、グルーピング切り替え、サマリー統計の表示。【F:frontend/src/app/features/board/page.ts†L1-L160】【F:frontend/src/app/core/state/workspace-store.ts†L1-L200】
- 保存フィルター CRUD API (`/filters`) とフロントでの保存/適用体験。【F:backend/app/routers/filters.py†L1-L78】
- Analytics API によるスナップショット作成・取得と Why-Why 分析、提案アクション生成。【F:backend/app/routers/analytics.py†L16-L200】
- Root cause / Suggested action / Initiative モデルによる継続的改善データの永続化。【F:backend/app/models.py†L301-L427】
- フロントの ContinuousImprovementStore によるスナップショット選択、原因ツリー、提案アクションのカード化、レポート草案生成。【F:frontend/src/app/core/state/continuous-improvement-store.ts†L1-L200】

### Out of Scope
- 外部 BI ツールへの自動エクスポート。
- モバイル専用 UI。
- AI による完全自動カード作成（承認フローなし）。

## 4. Personas
| Persona | Goals | Key Needs |
| --- | --- | --- |
| Product Manager | 再発する問題を把握し改善施策を優先したい | ラベル/ステータスごとの傾向と原因ツリー |
| Engineering Lead | 提案アクションをタスクへ落とし込みたい | ワンクリックのカード化と進捗トラッキング |
| Executive Sponsor | 定期レポートで改善成果を確認したい | AI がまとめたレポート草案と KPI 変化 |

## 5. User Stories & Acceptance Criteria
1. **Board Filtering** – ユーザーはクイックフィルター、ラベル、ステータス、検索テキストでカード一覧を絞り込める。フィルター状態はストアに保持され、ドラッグ＆ドロップ操作でも維持される。【F:frontend/src/app/features/board/page.ts†L1-L160】【F:frontend/src/app/core/state/workspace-store.ts†L83-L160】
2. **Filter Persistence** – ユーザーはフィルターを保存・更新・削除でき、保存者以外は閲覧できない。`/filters` API は認証ユーザーのレコードのみ返却する。【F:backend/app/routers/filters.py†L1-L78】
3. **Analytics Snapshots** – 管理者は期間とメトリクスを指定してスナップショットを作成し、API から一覧取得・詳細確認ができる。期間フィルターを指定すると開始/終了日の交差判定で絞り込む。【F:backend/app/routers/analytics.py†L16-L64】
4. **Why-Why Analyses** – 管理者はスナップショットやカードを対象に Why-Why 分析を作成し、原因ノードと提案アクションが自動生成される。提案にはタイトル・説明・労力・オーナーロールが含まれる。【F:backend/app/routers/analytics.py†L65-L200】【F:backend/app/models.py†L344-L427】
5. **Suggested Action Conversion** – ユーザーは提案アクションをカードに変換でき、変換後は `status='converted'` とカード ID が保存される。【F:frontend/src/app/core/state/continuous-improvement-store.ts†L148-L189】
6. **Initiative Tracking** – イニシアチブは進捗ログとサマリーを保持し、ダッシュボードでステータスとヘルスを確認できる。【F:frontend/src/app/core/state/continuous-improvement-store.ts†L108-L198】【F:backend/app/models.py†L332-L364】
7. **Report Drafting** – 利用者は指示文を入力して AI レポート草案を生成し、スナップショット切り替え時に内容が更新される。【F:frontend/src/app/core/state/continuous-improvement-store.ts†L130-L147】

## 6. Functional Requirements
### 6.1 Board & Filters
- クイックフィルターは `myAssignments` `dueSoon` `recentlyCreated` `highPriority` `noAssignee` を提供し、UI 文言をローカライズする。【F:frontend/src/app/features/board/page.ts†L29-L59】
- 直近で使用したフィルターとグルーピングをローカルストレージに保存し、次回訪問時に復元する。【F:frontend/src/app/core/state/workspace-store.ts†L22-L160】
- 保存フィルターの定義は任意の JSON を保持し、API は所有者以外のアクセスを 404 で拒否する。【F:backend/app/routers/filters.py†L33-L78】

### 6.2 Analytics & Why-Why
- スナップショットは期間・メトリクス・ナラティブを JSON カラムに保存し、最新順で取得する。【F:backend/app/routers/analytics.py†L16-L64】【F:backend/app/models.py†L301-L318】
- Why-Why 分析は深さごとのノード、提案アクション、推奨メトリクスを持ち、スナップショットまたはカードと関連付けられる。【F:backend/app/models.py†L318-L427】
- 提案アクションはタイトル/説明/労力/インパクト/担当ロール/期限候補を格納し、最大 2 件の追加アクションを派生させる。【F:backend/app/routers/analytics.py†L80-L163】

### 6.3 Continuous Improvement UI
- フロントストアはスナップショット・分析・イニシアチブを Signals で保持し、選択変更時にレポート草案を再生成する。【F:frontend/src/app/core/state/continuous-improvement-store.ts†L24-L147】
- 提案アクションをカード化する際は、カード作成ヘルパーにタイトル・サマリー・推奨ステータス・ラベルを渡し、進捗ログを追加する。【F:frontend/src/app/core/state/continuous-improvement-store.ts†L148-L200】

## 7. Non-Functional Requirements
- **Performance** – ボード操作は 50 ms 以内で再描画し、スナップショット API は期間フィルタ付きでも 400 ms 未満で応答する。
- **Security** – Analytics API は管理者ガードを通過したユーザーのみ利用できる。【F:backend/app/routers/analytics.py†L16-L32】
- **Reliability** – Why-Why 分析生成中にエラーが発生した場合、生成済みノードをロールバックし再試行可能にする。【F:backend/app/routers/analytics.py†L98-L200】
- **Observability** – スナップショット作成や提案アクション生成時のイベントをメトリクスに記録し、失敗率 >5% でアラートを発報する。

## 8. Risks & Mitigations
| Risk | Mitigation |
| --- | --- |
| フィルター設定が複雑化しユーザーが混乱する | 推奨クイックフィルターと保存済みプリセットを提供し、直近利用設定を自動復元する。【F:frontend/src/app/core/state/workspace-store.ts†L83-L160】 |
| 提案アクションが放置される | 変換済み状態をダッシュボードで可視化し、進捗ログを自動追記する。【F:frontend/src/app/core/state/continuous-improvement-store.ts†L148-L200】 |
| 分析データへの権限逸脱 | Analytics ルーターは管理者権限チェックを必須化する。【F:backend/app/routers/analytics.py†L16-L32】 |

## 9. Open Questions
- スナップショットの KPI 定義をワークスペースごとにカスタマイズする要望への対応方針。
- フィードバックサマリーを自動でイニシアチブに紐付けるためのデータスキーマ拡張。
