# Feature API Call & Data Flow Reference

このドキュメントは主要機能ごとに「どのUIアクションがどのAPIを順番に呼び出し、どのサービス／ストアにデータが渡るのか」を整理したものです。テスト観点や障害調査の際に、呼び出し経路を素早く追跡できるように構成しています。

## 1. ボードコラボレーション (Board Collaboration)

### 1.1 初期ロードと設定同期
1. ボードページは初期化時に `WorkspaceStore.refreshWorkspaceData` を呼び出し、アクティブユーザーの設定とカード一覧を読み込みます。【F:frontend/src/app/features/analytics/page.ts†L32-L61】【F:frontend/src/app/core/state/workspace-store.ts†L2128-L2176】
2. ストアは `WorkspaceConfigApiService` を通じて `/statuses`・`/labels`・`/workspace/templates` を並列で取得し、シグナルに反映してローカル設定を更新します。【F:frontend/src/app/core/state/workspace-store.ts†L2078-L2146】【F:frontend/src/app/core/api/workspace-config-api.service.ts†L49-L118】
3. 設定取得後に `CardsApiService.listCards` が `/cards` を呼び出し、取得したレスポンスを `mapCardFromResponse` で正規化してシグナルへ格納します。【F:frontend/src/app/core/state/workspace-store.ts†L2148-L2207】【F:frontend/src/app/core/api/cards-api.service.ts†L17-L42】【F:frontend/src/app/core/state/workspace-store.ts†L360-L402】
4. バックエンドの `/cards` GET はフィルタパラメータを解決した上で、認証ユーザーのカードと関連メタデータを返却します。【F:backend/app/routers/cards.py†L312-L420】

### 1.2 カードとサブタスクの更新
1. ドラッグ&ドロップやフォーム送信で `WorkspaceStore.persistCardUpdate` がローカル状態を更新しつつ `CardsApiService.updateCard` を呼び出します。【F:frontend/src/app/core/state/workspace-store.ts†L2232-L2277】【F:frontend/src/app/core/api/cards-api.service.ts†L44-L55】
2. `/cards/{card_id}` PUT は関連リソースの整合性を検証し、タイトルやラベルの変更があれば再スコアリングを実行して保存します。【F:backend/app/routers/cards.py†L522-L592】
3. 新規カードや提案カードの作成では `WorkspaceStore.createCardFromSuggestion` が `/cards` POST を叩き、成功時に即座にシグナルへ挿入します。【F:frontend/src/app/core/state/workspace-store.ts†L1703-L1750】【F:frontend/src/app/core/api/cards-api.service.ts†L34-L42】
4. バックエンドは作成時に日次上限チェック、関連エンティティ検証を行い、`RecommendationScoringService` でスコアを算出して `ai_confidence` と説明文を保存します。【F:backend/app/routers/cards.py†L420-L506】【F:backend/app/routers/cards.py†L506-L544】【F:backend/app/services/recommendation_scoring.py†L16-L111】

### 1.3 コメント・アクティビティとボードレイアウト
1. コメント投稿は `WorkspaceStore.addComment` がプレースホルダーを描画しつつ `/comments` POST を発行し、成功レスポンスで置き換えます。【F:frontend/src/app/core/state/workspace-store.ts†L1303-L1346】【F:frontend/src/app/core/api/comments-api.service.ts†L24-L37】
2. `/comments` ルーターは所有権を検証し、コメント保存と同時に `record_activity` で活動ログを記録します。【F:backend/app/routers/comments.py†L32-L85】
3. 任意の活動ログは `/activity-log` の GET/POST で取得・登録され、カード所有者とアクターのスコープに制限されます。【F:backend/app/routers/activity.py†L17-L50】
4. ボード表示設定はストアが `WorkspaceConfigApiService` に書き戻しつつ、`/board-layouts` PUT がユーザープレファレンスを永続化します。【F:frontend/src/app/core/state/workspace-store.ts†L684-L760】【F:backend/app/routers/preferences.py†L11-L33】

## 2. AIタスクインテーク (Analyzer)

### 2.1 提案生成フロー
1. Analyzer フォームはバリデーション後に `requestSignal` を更新し、`AnalysisGateway.createAnalysisResource` が `/analysis` POST ストリームを開始します。【F:frontend/src/app/features/analyze/page.ts†L42-L118】【F:frontend/src/app/core/api/analysis-gateway.ts†L286-L322】
2. ゲートウェイはワークスペース設定を解決してペイロードを構築し、レスポンスを `AnalysisResult` へマップします。【F:frontend/src/app/core/api/analysis-gateway.ts†L323-L360】
3. `/analysis` ルーターはユーザープロファイルとワークスペースオプションを組み立て、Gemini クライアントに委譲しつつ `analysis_sessions` に記録します。【F:backend/app/routers/analysis.py†L78-L123】
4. `GeminiClient` はプロンプト生成とレスポンス解析を行い、失敗時には例外を投げて HTTP 502 として返却します。【F:backend/app/services/gemini.py†L219-L371】
5. 取得した提案は `WorkspaceStore.isProposalEligible` で重複や競合を除外した上で UI に表示されます。【F:frontend/src/app/features/analyze/page.ts†L24-L73】

### 2.2 提案のカード化
1. ユーザーが提案を採用すると `WorkspaceStore.createCardFromSuggestion` がカード作成リクエストを正規化し `/cards` POST を実行します。【F:frontend/src/app/core/state/workspace-store.ts†L1703-L1750】
2. 作成されたカードはスコアと信頼度を保持したままシグナルへ挿入され、ボードへ即時反映されます。【F:frontend/src/app/core/state/workspace-store.ts†L1731-L1749】【F:frontend/src/app/core/state/workspace-store.ts†L360-L402】
3. バックエンドでは §1.2 と同じくスコアリングと活動ログ記録を行い、レスポンスとしてカードを返却します。【F:backend/app/routers/cards.py†L506-L544】

## 3. ステータスレポートアシスタント (Status Reporting)

### 3.1 作成〜送信シーケンス
1. レポートフォーム送信時に `StatusReportsGateway.createReport` が `/status-reports` POST を呼び出し、直後に `submitReport` で `/status-reports/{id}/submit` を叩きます。【F:frontend/src/app/features/reports/reports-page.component.ts†L74-L125】【F:frontend/src/app/core/api/status-reports-gateway.ts†L21-L49】
2. `StatusReportService.create_report` がセクション正規化とイベント記録を行い、ドラフトを保存します。【F:backend/app/services/status_reports.py†L41-L90】
3. `submit_report` はステータスを `processing` へ更新してイベントを追加し、Gemini 解析を実行して提案と処理メタデータを格納します。【F:backend/app/services/status_reports.py†L138-L205】
4. フロントエンドは返却された `StatusReportDetail` を表示し、成功トーストとともにフォームを初期化します。【F:frontend/src/app/features/reports/reports-page.component.ts†L101-L132】

### 3.2 再試行と提案活用
1. 失敗時は `StatusReportsGateway.retryReport` が `/status-reports/{id}/retry` を呼び出し、同じ解析パイプラインを再実行します。【F:frontend/src/app/core/api/status-reports-gateway.ts†L51-L57】【F:backend/app/services/status_reports.py†L168-L213】
2. 生成提案をカード化するワークフローは Analyzer と同じく `WorkspaceStore.createCardFromSuggestion` と `/cards` POST が利用されます。【F:frontend/src/app/features/reports/reports-page.component.ts†L133-L160】【F:frontend/src/app/core/state/workspace-store.ts†L1703-L1750】

## 4. アナリティクス & 継続的改善 (Analytics & Continuous Improvement)

### 4.1 スナップショットとWhy-Why解析
1. 管理者UIは `/analytics/snapshots` GET で期間フィルタ付き一覧を取得し、必要に応じて `/analytics/snapshots` POST で新規スナップショットを登録します。【F:backend/app/routers/analytics.py†L15-L62】
2. 根本原因分析が必要な場合は `/analytics/{target_id}/why-why` POST を発行し、対象スナップショットまたはカードからノードと提案を生成します。【F:backend/app/routers/analytics.py†L327-L370】
3. 解析結果の取得は `/analytics/why-why/{analysis_id}` GET が行い、ノードと提案を時系列順に整形して返します。【F:backend/app/routers/analytics.py†L364-L385】

### 4.2 提案のカード化と進捗連動
1. 継続的改善ストアは `convertSuggestedAction` で選択した提案を `WorkspaceStore.createCardFromSuggestion` に委譲し、カード生成後にローカルの提案・イニシアチブ状態を更新します。【F:frontend/src/app/core/state/continuous-improvement-store.ts†L140-L220】
2. 管理者がバックエンドから直接カード化する場合は `/suggested-actions/{id}/convert` を利用し、カード作成と提案の `converted` 更新、活動ログ記録が自動で行われます。【F:backend/app/routers/suggested_actions.py†L38-L104】

## 5. アピール生成 (Appeal Narrative Generation)

### 5.1 設定取得とテンプレート提示
1. クライアントは `/appeals/config` GET を呼び出し、利用可能なラベル・推奨フロー・フォーマットを取得します。【F:backend/app/routers/appeals.py†L10-L23】【F:backend/app/services/appeals.py†L219-L270】

### 5.2 生成リクエスト
1. `/appeals/generate` POST は入力サニタイズ後に Gemini へのリクエストを組み立て、失敗時はフォールバックテンプレートでレスポンスを返します。【F:backend/app/routers/appeals.py†L25-L33】【F:backend/app/services/appeals.py†L78-L167】
2. 成功時・失敗時ともに生成履歴は `AppealGenerationRepository.create` を通じて `appeal_generations` に保存されます。【F:backend/app/services/appeals.py†L268-L312】

## 6. 推薦スコアリング (Recommendation Scoring)

1. `/cards` POST／PUT はカード内容とユーザープロファイルから `RecommendationScoringService` でスコア・サブスコア・説明を生成します。【F:backend/app/routers/cards.py†L506-L566】【F:backend/app/routers/cards.py†L522-L592】
2. フロントエンドはカード一覧取得時に `mapCardFromResponse` で `ai_confidence` を取り込み、シグナル上のカードに反映します。【F:frontend/src/app/core/state/workspace-store.ts†L360-L402】
3. スコアリング失敗時は `failure_reason` が保存され、UI では信頼度0として扱われます。【F:backend/app/services/recommendation_scoring.py†L83-L111】

## 7. ワークスペース設定 (Statuses / Labels / Templates)

1. 設定ページはストアを介して `/statuses`・`/labels`・`/workspace/templates` を取得し、Angular シグナルで編集状態を管理します。【F:frontend/src/app/features/settings/page.ts†L24-L118】【F:frontend/src/app/core/state/workspace-store.ts†L2078-L2146】
2. 追加・更新・削除操作は `WorkspaceConfigApiService` が該当エンドポイントを呼び出し、成功後にストアが `refreshWorkspaceConfig` を再実行して設定を再同期します。【F:frontend/src/app/core/state/workspace-store.ts†L1864-L2065】【F:frontend/src/app/core/api/workspace-config-api.service.ts†L49-L118】
3. バックエンドは所有者チェックとテンプレート整合性を担保しつつ、ステータス削除時のテンプレート再設定やラベル重複排除を実施します。【F:backend/app/routers/statuses.py†L14-L71】【F:backend/app/routers/labels.py†L14-L69】【F:backend/app/routers/workspace_templates.py†L34-L128】

## 8. コンピテンシー評価 (Competency Evaluations)

1. プロフィール評価ページは `/users/me/evaluations` と `/users/me/evaluations/quota` を呼び出して履歴と残り回数を表示します。【F:frontend/src/app/features/profile/evaluations/page.ts†L44-L147】【F:backend/app/routers/competency_evaluations.py†L67-L115】
2. 評価実行時は `/users/me/evaluations` POST を発行し、バックエンドが期間正規化・日次クォータ確保・ジョブ生成を行った後、`CompetencyEvaluator` でスコアを作成します。【F:frontend/src/app/features/profile/evaluations/page.ts†L147-L209】【F:backend/app/routers/competency_evaluations.py†L116-L185】
3. 結果はコミット後に返却され、フロントエンドで JSON エクスポートやタイムラインに利用されます。【F:frontend/src/app/features/profile/evaluations/page.ts†L210-L275】

## 9. ガバナンス／管理コンソール (Governance & Admin)

1. 管理者は `/admin/api-credentials/{provider}` PUT を利用して資格情報を暗号化保存し、取得時には正規化されたモデル名が返却されます。【F:backend/app/routers/admin_settings.py†L47-L120】
2. クォータの既定値・個別値は `/admin/quotas/defaults` および `/admin/quotas/{user_id}` の GET/PUT で更新され、評価クォータ計算に即時反映されます。【F:backend/app/routers/admin_settings.py†L123-L207】
3. コンピテンシー定義や手動評価は `/competencies` 系エンドポイントで管理され、ジョブステータスと監査情報が保存されます。【F:backend/app/routers/competencies.py†L20-L199】

---

このリファレンスは、既存の `docs/data-flow-overview.md` と併用することで、ドメイン視点のデータ流れと具体的なAPIシーケンスを横断的に把握できるよう設計されています。
