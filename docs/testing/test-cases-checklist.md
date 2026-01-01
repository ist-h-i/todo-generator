# テストケース洗い出し（Playwright E2E / Angular Unit）

Playwright（E2E）と Angular（Unit）のテスト不足箇所を、**ファイル単位**でチェックリスト化したドキュメントです。  
実装時は `- [ ]` を `- [x]` にして消化してください。

## タグ（重点）

- 【初期ロード】初期画面ロード / 初回データ取得 / 初期状態
- 【選択】ユーザの選択（タブ/セレクト/トグル/チェック/カード選択など）
- 【入力】ユーザの入力（フォーム/検索/編集など）
- 【API_OK】バックエンド通信（正常系）
- 【API_NG】バックエンド通信（異常系: 4xx/5xx/timeout/network/validation）

## 共通メモ（E2E/Unit）

- Playwright は `frontend/e2e/support/api-mock.ts` の `mockApi()` を基本にして、**成功/失敗**を必ず両方用意する。
- `getByRole()` 等のアクセシビリティセレクタを基本にし、安定しない箇所は `data-testid` の付与を検討する。
- 「初期ロード」は **画面表示だけ**でなく、必要 API が揃って UI が操作可能になる状態までを含める。

---

## Playwright（`frontend/e2e`）

### `frontend/e2e/routing.spec.ts`（更新）

- [ ] 【初期ロード】未認証で `/` にアクセスすると `/login` にリダイレクトされる
- [ ] 【初期ロード】【API_OK】認証済みで `/` にアクセスすると `/board` にリダイレクトされる
- [ ] 【初期ロード】【API_NG】`GET /auth/me` が `401` の場合、トークンが削除され `/login` に遷移する
- [ ] 【初期ロード】【API_NG】`GET /auth/me` が `500` / network error の場合、セッションが成立せず `/login` に遷移する（必要ならグローバルエラー表示も確認）
- [ ] 【初期ロード】legacy トークン（`todo-generator/auth-token`）が新キーへ移行され、旧キーは削除される
- [ ] 【初期ロード】認証済みで未知パスにアクセスすると 404（NotFound）表示になる

### `frontend/e2e/auth.spec.ts`（更新）

- [ ] 【初期ロード】`/login` 初期表示（見出し/入力欄/送信ボタン disabled）
- [ ] 【入力】未入力で submit すると各入力に `aria-invalid` が立ち、`role="alert"` が表示される
- [ ] 【選択】login/register トグルでバリデーション状態と入力値が期待通りにリセットされる
- [ ] 【入力】register の confirm mismatch が即時にエラー表示され、送信できない
- [ ] 【API_NG】`POST /auth/login` が `401` で alert 表示・URL が `/login` のまま
- [ ] 【API_NG】`POST /auth/login` が `422`（validation）で、ユーザ向けメッセージが表示される
- [ ] 【API_OK】login 成功で `/board` 遷移・トークン保存・初期ロード（statuses/labels/templates/cards 等）が完走する
- [ ] 【API_NG】`POST /auth/register` が `409` で alert 表示・register 画面のまま
- [ ] 【API_OK】register 成功で login 画面に戻り、トークンは保存されない

### `frontend/e2e/shell.spec.ts`（更新）

- [ ] 【初期ロード】【API_OK】認証済みで Shell が表示され、ナビゲーションが操作可能になる
- [ ] 【初期ロード】【API_NG】Shell 配下のいずれかの API が失敗した場合、グローバルエラー（`role="alert"` 相当）が表示され閉じられる
- [ ] 【選択】ヘルプダイアログが開閉でき、Escape で閉じられる
- [ ] 【選択】テーマが `system -> dark -> light` の順に切り替わり、`localStorage` に永続化される
- [ ] 【初期ロード】legacy テーマキーが新キーへ移行される
- [ ] 【選択】ログアウトでトークンが削除され `/login` に戻る
- [ ] 【初期ロード】認証済みで未知パスにアクセスすると 404 表示になる

### `frontend/e2e/board.spec.ts`（更新）

- [ ] 【初期ロード】【API_OK】`/board` 初期ロードで必要 API（例: `/statuses`,`/labels`,`/board-layouts`,`/cards`）が揃い、ボードが表示される
- [ ] 【初期ロード】カードが 0 件の空状態が表示される
- [ ] 【入力】検索入力でカードが絞り込まれ、クリアで元に戻る
- [ ] 【選択】グルーピング（status/label）切替で列構成が変わる（UI と API 更新が必要なら確認）
- [ ] 【選択】クイックフィルターの ON/OFF で絞り込みが変わり、クリアで解除される
- [ ] 【選択】カードクリックで詳細 drawer が開き、閉じる操作で戻る
- [ ] 【入力】カード詳細のタイトル/概要を編集して保存できる（【API_OK】更新 API を呼ぶ）
- [ ] 【API_NG】カード更新 API 失敗時に、エラー表示・編集状態の扱い（ロールバック/再試行可否）が期待通り
- [ ] 【入力】コメント追加/編集/削除ができる（【API_OK】`/comments` 系）
- [ ] 【API_NG】コメント API 失敗時に、エラー表示・入力値保持が期待通り
- [ ] 【入力】サブタスク追加/編集（タイトル/担当/工数/期限/ステータス）/削除ができる（【API_OK】`/cards/*/subtasks`）
- [ ] 【API_NG】サブタスク API 失敗時に、エラー表示・入力値保持が期待通り
- [ ] 【選択】ドラッグ&ドロップでカード/サブタスクの移動ができる（【API_OK】更新 API を呼ぶ）
- [ ] 【API_NG】D&D 更新失敗時に、表示/順序が破綻しない（必要ならロールバック）

### `frontend/e2e/analyze.spec.ts`（更新）

- [ ] 【初期ロード】実際のルート（`/input`）で初期表示できる（現状 `/analyze` を参照している場合は修正）
- [ ] 【初期ロード】【API_OK】初期ロードで workspace 情報（labels/statuses 等）が揃い、フォームが操作可能
- [ ] 【入力】notes 未入力では submit が disabled、入力すると有効になる
- [ ] 【選択】ゴール方式（AI/手動）切替で UI と必須条件が切り替わる
- [ ] 【API_OK】submit で `POST /analysis` が呼ばれ、ローディング表示 -> 提案表示へ遷移
- [ ] 【API_NG】`POST /analysis` が `500`/timeout/network で、エラー表示・再試行導線が期待通り
- [ ] 【入力】提案の title/summary/status/labels/subtasks を編集できる
- [ ] 【API_OK】「この案をカードに追加」でカード作成が成功し、成功フィードバックが表示される
- [ ] 【API_NG】カード作成（import）失敗でエラー表示され、提案が消えない/再試行できる
- [ ] 【API_OK】「すべての案をボードに追加」で複数登録できる

### `frontend/e2e/analytics-immunity-map.spec.ts`（更新）

- [ ] 【初期ロード】【API_OK】`/analytics` 初期ロードで集計（summary/breakdown）が表示される
- [ ] 【選択】【API_OK】候補カード生成（`POST /analysis/immunity-map/candidates`）が成功し、候補が表示される（既存: nested/array 形式の両対応）
- [ ] 【API_OK】候補が 0 件のとき、空状態メッセージが適切に表示される
- [ ] 【API_NG】候補生成が失敗したとき、エラー表示（グローバル or 画面内）が期待通り
- [ ] 【選択】advanced mode の ON/OFF で入力 UI が切り替わる
- [ ] 【選択】候補の選択/解除ができ、選択数が表示される
- [ ] 【入力】候補テキストの編集ができる
- [ ] 【API_OK】免疫マップ生成（`POST /analysis/immunity-map`）が成功し、Mermaid が表示される
- [ ] 【API_NG】免疫マップ生成が失敗したとき、エラー表示・再試行が期待通り
- [ ] 【選択】Mermaid ダイアログの開閉（Escape 含む）と、フォーカスが崩れない

### `frontend/e2e/settings.spec.ts`（更新）

- [ ] 【初期ロード】【API_OK】`/settings` 初期ロードで labels/statuses/templates が表示される
- [ ] 【入力】【API_OK】ラベル追加ができ、一覧が更新される（既存）
- [ ] 【入力】【API_OK】ステータス追加ができ、一覧が更新される
- [ ] 【API_NG】ラベル/ステータス追加が失敗したとき、エラー表示・入力値保持が期待通り
- [ ] 【選択】【API_OK】テンプレートの作成（必須入力あり）ができる
- [ ] 【選択】【API_OK】テンプレートの編集/更新ができる
- [ ] 【選択】【API_OK】テンプレートの削除ができる（system default は削除できない）
- [ ] 【API_NG】テンプレート操作の失敗時に、編集状態/選択状態が破綻しない
- [ ] 【選択】【API_OK】ステータス削除時に fallback が適用され、テンプレートの defaultStatus が不正値にならない

### `frontend/e2e/profile.spec.ts`（更新）

- [ ] 【初期ロード】【API_OK】プロフィールダイアログを開くと `GET /profile/me` が呼ばれ、値が反映される
- [ ] 【入力】nickname が空のとき validation で保存できず、alert が表示される（既存）
- [ ] 【入力】【API_OK】保存成功でダイアログが閉じ、Shell の表示名が更新される（既存）
- [ ] 【選択】dirty 状態でキャンセルすると confirm が出て、dismiss で閉じない（既存）
- [ ] 【入力】アバターのファイル種別/サイズ制約が守られ、エラー表示される（既存）
- [ ] 【API_NG】保存失敗（`PUT /profile/me` 5xx）で alert 表示・ダイアログは閉じない（既存）
- [ ] 【API_NG】取得失敗（`GET /profile/me` 5xx/timeout）でエラー表示・再試行導線がある
- [ ] 【選択】【入力】roles の選択上限（最大件数）を超えた場合にエラー表示・追加されない
- [ ] 【入力】カスタム role 追加/削除ができ、roles 配列が期待通りに更新される
- [ ] 【選択】【API_OK】アバター削除（remove）で payload が正しく送られる

### `frontend/e2e/profile-evaluations.spec.ts`（追加）

- [ ] 【初期ロード】【API_OK】`/profile` 初期ロードで評価履歴が表示される
- [ ] 【初期ロード】【API_OK】quota が表示され、残数が 0 の場合は実行ボタンが disabled になる
- [ ] 【API_NG】評価履歴取得失敗時にエラー表示される
- [ ] 【API_NG】quota 取得失敗時にエラー表示される
- [ ] 【選択】competency の選択/全選択/解除ができ、batch 実行の enabled 条件が満たされる
- [ ] 【API_OK】単体評価/バッチ評価が成功し、フィードバックが表示される
- [ ] 【API_NG】評価実行が `429` の場合、quota が再取得され、limit reached 表示に切り替わる
- [ ] 【選択】最新評価の JSON エクスポートが動作し、ファイル名が sanitize される

### `frontend/e2e/reports.spec.ts`（追加）

- [ ] 【初期ロード】【API_OK】`/reports` 初期ロードでフォームが表示される
- [ ] 【入力】本文が空の状態では「作成」操作ができない（/できても no-op）
- [ ] 【入力】【API_OK】セクション追加/削除・タグ入力ができ、payload が期待通りになる
- [ ] 【API_OK】`POST /status-reports`（作成）成功で詳細が表示され、提案がフォームに展開される
- [ ] 【API_NG】作成失敗時にエラー表示される（detail 優先）
- [ ] 【入力】提案（title/summary/status/labels/priority/subtasks）編集ができる
- [ ] 【API_OK】提案の publish（カード作成）成功で、ボードへ反映される
- [ ] 【API_NG】publish 失敗時にエラー表示され、編集内容が失われない

### `frontend/e2e/achievement-output.spec.ts`（追加）

- [ ] 【初期ロード】【API_OK】`/achievement-output` 初期ロードで config が表示され、初期選択がセットされる
- [ ] 【入力】subjectType=label/custom の切替で必須入力が切り替わる
- [ ] 【入力】flow の重複/空白が正規化され、最大 5 件に制限される
- [ ] 【選択】formats の選択/解除ができ、0 件のときはバリデーションエラーになる
- [ ] 【API_OK】生成成功で結果が表示され、format 切替で表示内容が変わる
- [ ] 【API_NG】生成が `429`（limit）で limit reached 表示になる
- [ ] 【API_NG】生成が 5xx/timeout/network でエラー表示される
- [ ] 【選択】コピーが成功/失敗でステータス表示が切り替わる
- [ ] 【選択】ダウンロード（Markdown 等）が動作する（ファイル名/拡張子/Content を確認）

### `frontend/e2e/admin.spec.ts`（追加）

- [ ] 【初期ロード】非 admin ユーザは `/admin` に入れず `/board` へ
- [ ] 【初期ロード】【API_OK】admin ユーザは `/admin` 初期ロードでき、主要タブが操作できる
- [ ] 【選択】タブ切替（competencies/evaluations/users/settings）ができる
- [ ] 【入力】【API_OK】competency の作成/更新/削除ができる
- [ ] 【API_NG】admin API 失敗時に、エラー表示とフォーム状態（入力保持）が期待通り
- [ ] 【入力】【API_OK】ユーザ quota 変更ができ、成功メッセージが出る
- [ ] 【API_NG】quota 更新失敗時に、エラー表示と値の戻りが期待通り

---

## Angular Unit（`frontend/src/app/**/*.spec.ts`）

### `frontend/src/app/core/api/api.config.spec.ts`（追加）

- [ ] 【初期ロード】`buildApiUrl()` が相対パスに `API_BASE_URL` を付与する
- [ ] 【初期ロード】`buildApiUrl()` に絶対 URL を渡した場合はそのまま返す
- [ ] 【初期ロード】`isApiRequestUrl()` が相対 URL を API と判定する
- [ ] 【初期ロード】`isApiRequestUrl()` が絶対 URL の場合に `API_BASE_URL` prefix のみ true になる
- [ ] 【初期ロード】クエリ/`localStorage`/`meta`/`window.__VERBALIZE_API_BASE_URL__` の優先順位が期待通り

### `frontend/src/app/core/auth/auth.spec.ts`（追加）

- [ ] 【初期ロード】起動時に `restoreSession()` が走り、token が無い場合は `initialized=true` になる
- [ ] 【初期ロード】【API_OK】token があり `GET /auth/me` 成功で `user` がセットされる
- [ ] 【初期ロード】【API_NG】token があり `GET /auth/me` 失敗でセッションがクリアされる
- [ ] 【初期ロード】legacy token が新キーに移行される（旧キー削除含む）
- [ ] 【入力】【API_OK】`login()` 成功で token/user がセットされ、`pending` が正しく遷移する
- [ ] 【入力】【API_NG】`login()` 失敗（401/422/0/500）で `error` がユーザ向けメッセージになる
- [ ] 【入力】【API_OK】`register()` 成功でレスポンスを返し、`error` がクリアされる
- [ ] 【入力】【API_NG】`register()` 失敗（409/422/0/500）で `error` がユーザ向けメッセージになる
- [ ] 【選択】`logout()` で token/user がクリアされ、storage も更新される
- [ ] 【API_OK】`applyUserProfile()` が user を上書きする

### `frontend/src/app/core/auth/auth.interceptor.spec.ts`（追加）

- [ ] 【API_OK】token がある場合、API リクエストに `Authorization: Bearer <token>` が付与される
- [ ] 【API_OK】token が無い場合、ヘッダは付与されない
- [ ] 【API_OK】非 API URL（`isApiRequestUrl=false`）にはヘッダを付与しない

### `frontend/src/app/core/auth/admin.guard.spec.ts`（追加）

- [ ] 【初期ロード】admin ユーザは `true` を返す
- [ ] 【初期ロード】未認証は `/login` にリダイレクトする `UrlTree` を返す
- [ ] 【初期ロード】非 admin は `/board` にリダイレクトする `UrlTree` を返す
- [ ] 【初期ロード】`ensureInitialized()` が呼ばれる

### `frontend/src/app/features/shell/shell.page.spec.ts`（追加）

- [ ] 【初期ロード】theme 初期値が `localStorage`/legacy から復元される
- [ ] 【選択】theme toggle で cycle（system->dark->light）し、`documentElement.classList` が更新される
- [ ] 【初期ロード】`matchMedia` 変化で system theme が反映される（可能なら）
- [ ] 【初期ロード】グローバル loading が toast（loading）として表示/解除される
- [ ] 【初期ロード】グローバル error が toast（error）として表示される
- [ ] 【選択】help/profile ダイアログ open/close の signal が切り替わる
- [ ] 【選択】logout で `Auth.logout()` と `router.navigateByUrl('/login')` が呼ばれる
- [ ] 【初期ロード】`displayName()` が `getDisplayName()` の仕様通りに表示名を返す

### `frontend/src/app/features/shell/data/hover-messages.spec.ts`（追加）

- [ ] 【初期ロード】`show()` が新規 message を先頭に追加する
- [ ] 【初期ロード】severity ごとの自動 dismiss（notification/warning/system）と sticky（error/loading）の挙動
- [ ] 【選択】`dismiss()` で `dismissing=true` になり、exit duration 後に削除される
- [ ] 【選択】`dismiss()` 二重呼び出しが安全（タイマー多重登録しない）
- [ ] 【初期ロード】`clearAll()` で全メッセージとタイマーがクリアされる
- [ ] 【初期ロード】`window` が無い環境でも破綻しない（即時削除/タイマー未使用）

### `frontend/src/app/features/shell/data/profile.spec.ts`（追加）

- [ ] 【API_OK】`fetch()` が `GET /profile/me` を呼ぶ
- [ ] 【API_OK】`update()` が `PUT /profile/me` を `FormData` で送る
- [ ] 【入力】nickname/bio が trim されて送られる
- [ ] 【入力】experienceYears が `null` の場合は送られない / 数値の場合は文字列で送られる
- [ ] 【選択】roles が空のとき送られない / 非空のとき JSON で送られる
- [ ] 【選択】removeAvatar=true のとき `remove_avatar=true` が送られる
- [ ] 【入力】avatarFile がある場合 `avatar` が添付される

### `frontend/src/app/features/shell/ui/profile-dialog/profile-dialog.spec.ts`（追加）

- [ ] 【初期ロード】【API_OK】open 時に profile を取得し、フォームに反映される
- [ ] 【API_NG】取得失敗時にエラー表示され、loading が解除される
- [ ] 【入力】nickname 必須・bio 任意などのバリデーションが UI と一致する
- [ ] 【選択】role の選択/解除ができ、最大件数超過でエラーになる
- [ ] 【入力】カスタム role 入力で roles に追加でき、重複/空白は無視される
- [ ] 【入力】avatar の種別/サイズチェックでエラーになり、input がリセットされる
- [ ] 【選択】remove avatar 操作で preview と state が更新される
- [ ] 【API_OK】保存成功で `saved`（output）が emit され、dirty が解消される
- [ ] 【API_NG】保存失敗でエラー表示され、フォーム値は保持される
- [ ] 【選択】dirty のまま dismiss しようとすると confirm が出る（cancel なら閉じない）

### `frontend/src/app/features/shell/ui/help-dialog/help-dialog.spec.ts`（追加）

- [ ] 【初期ロード】ヘルプの主要セクションが表示される（最低限の smoke）
- [ ] 【選択】close 操作（ボタン or Escape 相当の input）で閉じるイベントが発火する

### `frontend/src/app/features/board/state/board-page.store.spec.ts`（追加）

- [ ] 【初期ロード】constructor/初期処琁Eで `WorkspaceStore` の状態に追従できる
- [ ] 【入力】`updateSearch()` が filters を更新し、空白入力は正規化される
- [ ] 【選択】クイックフィルターの toggle が filters を更新し、重複しない
- [ ] 【選択】`clearFilters()` で filters が初期化される
- [ ] 【選択】`selectGrouping()` で grouping が切り替わり、必要なら layout 更新が呼ばれる
- [ ] 【選択】`openCard()` で selectedCard が切り替わり、初回は comments 読み込みが走る
- [ ] 【入力】カード詳細保存が `WorkspaceStore.updateCard` 系に委譲される
- [ ] 【入力】コメント追加/編集/削除が `WorkspaceStore` の対応メソッドに委譲される
- [ ] 【入力】サブタスク追加/更新/削除が `WorkspaceStore` の対応メソッドに委譲される
- [ ] 【入力】newSubtaskForm が valid のときだけ submit でき、追加後に form が reset される
- [ ] 【選択】drag&drop の drop event で移動が委譲される（無効状態では no-op）
- [ ] 【選択】label toggle で labelIds が更新される

### `frontend/src/app/features/board/board.page.spec.ts`（追加）

- [ ] 【初期ロード】`afterNextRender` で `refreshWorkspaceData()` が呼ばれる
- [ ] 【選択】表示形態（status/label）ボタンが store のメソッドに委譲される
- [ ] 【入力】検索入力イベントが store に委譲される

### `frontend/src/app/features/analyze/state/analyze-page.store.spec.ts`（追加）

- [ ] 【初期ロード】constructor で `refreshWorkspaceData()` が呼ばれる
- [ ] 【入力】`canSubmit` が notes/objective 条件を正しく判定する（autoObjective ON/OFF）
- [ ] 【API_OK】submit で request が作られ、resource が loading->success になると提案が editable に展開される
- [ ] 【API_NG】resource error でエラー toast が出て、提案がクリアされる
- [ ] 【API_OK】提案 0 件（eligible=0）で notice toast が出る
- [ ] 【入力】proposal の title/summary/status/labels/subtasks の編集 API が state を更新する
- [ ] 【API_OK】`publishProposals()` 成功で success feedback が出てフォームが reset される（preserveFeedback の扱い含む）
- [ ] 【API_NG】`publishProposals()` 失敗で error feedback が出て提案が残る
- [ ] 【初期ロード】同一結果の再受信で toast/編集 state が過剰に更新されない（fingerprint）

### `frontend/src/app/features/analyze/analyze.page.spec.ts`（追加）

- [ ] 【初期ロード】ページ生成できる（store 依存の wire-up smoke）
- [ ] 【入力】submit が store の `handleSubmit` に委譲される

### `frontend/src/app/features/analytics/state/analytics-page.store.spec.ts`（追加）

- [ ] 【初期ロード】constructor で `refreshWorkspaceData()` が呼ばれる
- [ ] 【初期ロード】status/label/point summary の集計が cards/settings に追従する
- [ ] 【API_OK】candidates の request 生成で `POST /analysis/immunity-map/candidates` が呼ばれる
- [ ] 【API_NG】candidates error 時に error signal が立つ
- [ ] 【初期ロード】候補 payload の coerce（nested/array/JSON string/record numeric keys）を網羅する
- [ ] 【選択】candidate selection の toggle が ids を更新する
- [ ] 【API_OK】generate で `POST /analysis/immunity-map` が呼ばれ、結果 state が更新される
- [ ] 【API_NG】generate 失敗で generationError が立ち、pending が解除される
- [ ] 【選択】Mermaid dialog open/close と Escape の扱いが破綻しない

### `frontend/src/app/features/analytics/analytics.page.spec.ts`（追加）

- [ ] 【初期ロード】ページ生成できる（store 依存 wire-up smoke）
- [ ] 【選択】Escape で Mermaid dialog が閉じる（`onKeydown`）
- [ ] 【選択】generate 成功後に Mermaid viewer までスクロールされる（可能なら）

### `frontend/src/app/features/settings/state/settings-page.store.spec.ts`（更新）

- [ ] 【初期ロード】constructor で `refreshWorkspaceData()` が呼ばれる
- [ ] 【入力】【API_OK】`saveLabel()` が trim して addLabel し、成功で form が reset される
- [ ] 【API_NG】`saveLabel()` 失敗時に例外を飲み込み、form 値が維持される
- [ ] 【入力】【API_OK】`saveStatus()` が addStatus し、成功で form が reset される
- [ ] 【選択】【API_OK】`openTemplateEditor()` で edit form が template 値で初期化される
- [ ] 【選択】`cancelTemplateEdit()` で editing が解除され、edit form が初期化される
- [ ] 【入力】【API_OK】`updateTemplatePreset()` が updateTemplate を呼び、成功で editor が閉じる
- [ ] 【選択】`removeTemplate()` が system default を削除しない
- [ ] 【選択】【API_OK】`removeStatus()` で fallback が適用され、defaultStatus が不正値にならない
- [ ] 【選択】`removeLabel()` が `false` の場合は selection を変更しない

### `frontend/src/app/features/settings/settings.page.spec.ts`（追加）

- [ ] 【初期ロード】ページ生成できる（store 依存 wire-up smoke）

### `frontend/src/app/features/profile/profile-evaluations.page.spec.ts`（追加）

- [ ] 【初期ロード】【API_OK】init で evaluations/quota が取得され、loading が解除される
- [ ] 【API_NG】evaluations/quota/competencies の各取得失敗でエラーが表示される
- [ ] 【選択】toggle/selectAll/clear の選択ロジックが期待通り
- [ ] 【初期ロード】limit reached で実行が disabled、remainingCount が正しい
- [ ] 【API_OK】単体/バッチ実行成功で feedback が出て、必要なら evaluations が更新される
- [ ] 【API_NG】実行失敗で actionError が出る（429/401 は quota 再取得）
- [ ] 【選択】exportLatestAsJson が download を開始し、ファイル名が sanitize される

### `frontend/src/app/features/reports/reports.page.spec.ts`（更新）

- [ ] 【初期ロード】constructor で `refreshWorkspaceData()` が呼ばれる
- [ ] 【入力】`buildCreatePayload()` が空本文を弾き、タグ/セクションを正規化する
- [ ] 【API_OK】createReport 成功で detail がセットされ、proposals が form に展開される
- [ ] 【API_NG】createReport 失敗で `error` が detail 優先で表示される（0/5xx も含む）
- [ ] 【入力】proposal 編集（status/labels/priority/subtasks）が payload に反映される
- [ ] 【API_OK】publish（card 作成/submit）成功で成功メッセージが出る
- [ ] 【API_NG】publish 失敗でエラー表示・入力保持ができる

### `frontend/src/app/features/admin/admin.page.spec.ts`（更新）

- [ ] 【初期ロード】【API_OK】初期ロードで必要データ（competencies/users/evaluations/settings 等）が取得される
- [ ] 【API_NG】初期ロード失敗でエラー表示される（detail 優先）
- [ ] 【選択】タブ切替で表示/操作対象が切り替わる
- [ ] 【入力】【API_OK】competency の CRUD とフォームバリデーション
- [ ] 【入力】【API_OK】quota defaults / user quota 更新が正しい payload で送信される
- [ ] 【API_NG】更新失敗でエラー表示・フォーム値保持が期待通り

### `frontend/src/app/features/achievement-output/achievement-output.page.spec.ts`（更新）

- [ ] 【初期ロード】【API_OK】config 取得成功で form 初期値が設定される（labels/formats/recommended_flow）
- [ ] 【API_NG】config 取得失敗でエラー表示される（detail 優先）
- [ ] 【入力】subjectType のバリデーション（label/custom）と subjectValue 必須
- [ ] 【入力】flow の正規化（重複/空白除去、最大 5）
- [ ] 【選択】formats が 0 件だとバリデーションエラー
- [ ] 【API_OK】generate 成功で結果が editableFormats に展開される
- [ ] 【API_NG】generate が 429 のとき limitReached が立つ
- [ ] 【選択】copyStatus が一定時間で idle に戻る

### `frontend/src/app/shared/ui/mermaid-viewer/mermaid-viewer.spec.ts`（追加）

- [ ] 【初期ロード】空文字/空白のみの code で render しない（canvas が空、error なし）
- [ ] 【入力】fenced code block（```mermaid```）が正規化される
- [ ] 【選択】zoomIn/zoomOut が min/max を超えない（0.25-4, 0.1 step）
- [ ] 【API_NG】mermaid render 例外で `renderError` がセットされる
- [ ] 【初期ロード】render の競合（requestId）が古い結果を採用しない
- [ ] 【選択】テーマ（dark/default）の判定が `documentElement.classList` に追従する

### `frontend/src/app/shared/ui/page-header/page-header.spec.ts`（追加）

- [ ] 【初期ロード】title が required で描画される
- [ ] 【初期ロード】headingLevel で見出しタグが変わる（h1/h2/h3）
- [ ] 【初期ロード】description/eyebrow がある場合のみ表示される
- [ ] 【初期ロード】actions slot（content projection）が表示される

### `frontend/src/app/shared/ui/not-found/not-found.page.spec.ts`（追加）

- [ ] 【初期ロード】404 ページが描画される（見出し/導線リンクの smoke）

### `frontend/src/app/shared/utils/display-name.spec.ts`（追加）

- [ ] 【初期ロード】nickname がある場合は trim して返す
- [ ] 【初期ロード】nickname が空/空白の場合は email を trim して返す
- [ ] 【初期ロード】nickname/email が両方無い場合は空文字になる
