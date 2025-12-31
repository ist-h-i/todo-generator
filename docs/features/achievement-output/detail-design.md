# 実績出力 (Achievement Output) Detailed Design

## 1. Purpose

「実績出力」は、実績（カードの成果要約）を材料に、因果関係が伝わる文章を複数形式で生成・出力するフロントエンド機能である。
バックエンドには既に `GET /appeals/config` と `POST /appeals/generate` が存在するため、まずは UI とルーティング、API クライアントを整備して接続する。

## 2. UX / Screen Layout (MVP)

1画面で完結させる。

- **入力エリア**
  - subject: ラベル選択 / 自由入力（120文字目安）
  - flow: 推奨フローを初期値にして編集（最大5ステップ）
  - formats: Markdown / 箇条書き / CSV
  - 生成ボタン（生成中はスピナーと disable）
  - `warnings` 表示（バナー/インライン）
- **出力エリア**
  - タブ: `Markdown` / `箇条書き` / `CSV`
  - 各タブ: テキスト表示（textarea）+「コピー」「ダウンロード（CSVのみ必須）」+ tokens_used の任意表示

## 3. Navigation

- ヘッダーのグローバルナビに `実績出力` を追加する。
- 追加位置は「コンピテンシー」の右隣。
- AI 機能として `ai: true` を付与し、既存の AI マーク表示ルールに合わせる。

対象実装（予定）:
- `frontend/src/app/features/shell/shell.page.ts` の `navigationLinks`

## 4. Routing

- `frontend/src/app/features/shell/shell.routes.ts` 配下に新規ルートを追加する。
  - path（案）: `achievement-output`
  - lazy-load: `@features/achievement-output/achievement-output.routes`
- feature 側は `AchievementOutputPage`（standalone component）をエントリにする。

## 5. Frontend Data Contract

バックエンドの Pydantic スキーマをフロントの型へミラーする。

### 5.1 Config (`GET /appeals/config`)

- `labels[]`: `{ id, name, color, description, achievements[] }`
- `recommended_flow[]`: `string[]`
- `formats[]`: `{ id, name, description, editor_mode }`

### 5.2 Generate (`POST /appeals/generate`)

- Request
  - `subject`: `{ type: "label" | "custom", value: string }`
  - `flow`: `string[]`（1〜5）
  - `formats`: `string[]`（1〜4）
  - `achievements?`: `{ id, title, summary? }[]`
- Response
  - `generation_id`, `subject_echo`, `flow[]`, `warnings[]`
  - `formats`: `{ [formatId: string]: { content: string, tokens_used?: number } }`

## 6. API Client (Frontend)

新規に API クライアントを追加し、画面からはそのクライアント経由で呼び出す。

候補:
- `frontend/src/app/core/api/appeals-api.ts`
  - `getConfig(): Observable<AppealConfigResponse>`
  - `generate(payload: AppealGenerationRequest): Observable<AppealGenerationResponse>`

## 7. Page State Management

MVP はページコンポーネント内の signals + forms で完結させる。

- `config = signal<AppealConfigResponse | null>(null)`
- `configError = signal<string | null>(null)`
- `generating = signal(false)`
- `result = signal<AppealGenerationResponse | null>(null)`
- `activeTab = signal<'markdown' | 'bullet_list' | 'table'>('markdown')`

## 8. Error Handling

- ネットワーク/5xx: 既存の HTTP エラーハンドリング（グローバルエラー表示）を優先しつつ、ページ内にも再試行導線を置く。
- 429: 本日の上限到達としてユーザーに明示する（ボタンを disable し、文言を表示）。

## 9. Security & Rendering Rules

- 生成結果は HTML として描画しない（`innerHTML` などを使わない）。
- コピー対象は表示中のプレーンテキスト（Markdown/CSV はそのまま貼り付けられることを優先）。

## 10. Telemetry (Optional)

導入できる場合は以下のイベントを追加する。

- `achievement_output.open`
- `achievement_output.generate`（format数、flow長、subjectType などを付与）
- `achievement_output.copy`（tab）
- `achievement_output.download`（csv）

## 11. Test Approach (MVP)

- API クライアントの unit test（URL/メソッド/型）
- ページの unit test（初期ロード、生成成功、429 表示、タブ切替）

## 12. Future Enhancements

- 残り回数の事前表示（クォータ API 追加）
- 生成履歴 UI（`GET /appeals/recent` など）
- 実績検索/選択 UI（カード全件からのピック）

