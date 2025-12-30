# 免疫マップ（AI 自動抽出 + カード選択 + Mermaid 可視化）設計詳細

## 1. 方針

- AI には Mermaid を直接生成させず、**構造化データ（ノード/参照関係）を生成**させる。
- Mermaid 文字列はサーバ側で組み立てる（スキーマ検証・非表示ルール・エスケープを確実にする）。
- A（やるべき/やれない/やりたい）は、ユーザー手入力ではなく **参照データから AI が候補を生成**し、UI はカード選択で開始できるようにする。
- 深層心理は **観察事実ではなく仮説**として扱い、医療/診断的表現は避ける。観察（データ由来）と推測（AI 仮説）を区別できる形で返す。

## 2. データフロー（高レベル）

1. フロントが `POST /analysis/immunity-map/candidates` を呼び、A 候補カード一覧を取得する。
2. UI は候補を表示し、既定で 1 件を事前選択する（ユーザーは変更可）。
3. フロントが `POST /analysis/immunity-map` を呼び、選択された A を入力として免疫マップを生成する（背景は原則サーバ側で自動補完）。
4. UI は読み解きカード（任意）と Mermaid を表示し、コピーと Mermaid Live Editor への導線を提供する。

## 3. データモデル（論理）

### 3.1 ImmunityMapPayload（免疫マップ本体）

- `nodes[]`
  - `id`: `A1` など（カテゴリ文字 + 連番）
  - `group`: `A|B|C|D|E|F`
  - `label`: 表示文（必須、空は禁止）
  - `kind`（任意）: A の場合のみ `should|cannot|want`
- `edges[]`
  - `from`: ノード ID
  - `to`: ノード ID

制約:

- `group` ごとの意味は `docs/features/immunity-map/requirements.md` の定義に従う。
- 許可する接続は A→B, A→C, B→D, B→E, C→E, C→F のみ。
- ラベルは 1 ノードあたり上限文字数を設ける（例: 200 文字）。

### 3.2 A 候補カード（ImmunityMapCandidate）

- `id`: UI 上の候補識別子（例: `cand_1`）
- `a_item`: `{ kind: "should"|"cannot"|"want", text: string }`
- `rationale`: 候補の理由（仮説）
- `confidence`（任意）: 0～100
- `questions`（任意）: 低信頼時の確認質問（例: 1～3 件）
- `evidence[]`: 根拠参照（最小限の抜粋）
  - `type`: `status_report|card|snapshot|other`
  - `id`: 参照元 ID（存在する場合）
  - `snippet`（任意）: 1～2 文程度の抜粋
  - `timestamp`（任意）: ISO8601

### 3.3 読み解きカード（任意）

免疫マップ生成結果に付随する「ワンクリックの言語化」用のカード群（UI 表示用）。

- `title`
- `kind`: `observation|hypothesis|barrier|need|assumption|next_step` など（案）
- `body`: Markdown/プレーンテキスト（短文）
- `evidence[]`（任意）: 上記と同様

## 4. API 設計（案）

### 4.1 A 候補生成

- `POST /analysis/immunity-map/candidates`
  - Request（例）:
    - `window_days`（任意）: number（例: 28）
    - `max_candidates`（任意）: number（例: 10）
    - `include`（任意）: `{ status_reports?: boolean, cards?: boolean, profile?: boolean, snapshots?: boolean }`
  - Response:
    - `candidates[]`: `ImmunityMapCandidate[]`
    - `context_summary`（任意）: string（サーバ側で組み立てた要約）
    - `used_sources`: `{ status_reports: number, cards: number, snapshots: number }` など
    - `model` / `token_usage`（任意）

### 4.2 免疫マップ生成

- `POST /analysis/immunity-map`
  - Request（例）:
    - `a_items[]`: `{ kind: "should"|"cannot"|"want", text: string }`（必須）
    - `context`（任意）: string（上級。追記用）
    - `context_policy`（任意）: `"auto"|"manual"|"auto+manual"`（既定: `auto`）
    - `target`（任意）: `{ type: "snapshot"|"card", id: string }`
  - Response:
    - `payload`: `ImmunityMapPayload`
    - `mermaid`: string（単一ドキュメント）
    - `summary`（任意）: string
    - `readout_cards[]`（任意）: 「読み解きカード」
    - `model` / `token_usage`（任意）

エラー方針:

- Gemini 未設定: `503 Service Unavailable`
- Gemini 呼び出し失敗: `502 Bad Gateway`
- スキーマ不正（AI 応答が要件を満たさない）: `502`（再実行可能なエラーとして返す）
- 入力不正（A が 0 件等）: `422 Unprocessable Entity`

## 5. コンテキスト組み立て（サーバ側）

### 5.1 参照データ取得

- Status reports:
  - 候補生成/免疫マップ生成のためには「過去のレポート」が必要となる。
  - 現状の status report 実装が完了時に削除される場合、**削除しない運用**へ変更するか、免疫マップ用に別テーブルへ「最小限の本文/要約」をアーカイブする。
- Cards:
  - `completed_at` を中心に消化状況を集計し、WIP/期限超過/ラベル分布などのサマリを生成する。
- Profile:
  - `build_user_profile` 相当の最小フィールド（role/experience/bio 等）をコンテキストに含める（推測はしない）。

### 5.2 コンテキストパック（プロンプト投入用）

Gemini へ送信する情報は最小化しつつ、候補生成・免疫マップ生成に必要な「事実」を渡す。

- `profile`（任意）
- `status_report_excerpts[]`（任意・上限あり）
- `card_metrics`（必須: 集計結果。テキストは短く）
- `notable_cards[]`（任意・上限あり: タイトル + 最小限の説明抜粋）

## 6. AI 生成（プロンプト/スキーマ）

### 6.1 候補生成（A cards）

- 入力: コンテキストパック
- 出力: `ImmunityMapCandidate[]`（JSON schema）
- ルール:
  - 観察（データ由来）と推測（仮説）を混同しない。
  - 過度に断定しない。医療/診断的表現を避ける。
  - `evidence` を必ず付ける（0 件は許可しない、または低信頼として扱う）。

### 6.2 免疫マップ生成（B～F）

- 入力: 選択された A + コンテキストサマリ（`context_policy=auto` の場合はサーバ側で付与）
- 出力: `ImmunityMapPayload` + `summary`（+ 任意で `readout_cards`）
- ルール:
  - A のノードはサーバ側で固定生成し、AI には生成させない（参照のみ）。
  - 接続制約と非表示ルール（空ノード/空エッジ/空カテゴリは出力しない）を前提に、AI 出力後にサーバでバリデーション/正規化する。

### 6.3 スキーマ検証（サーバ側）

- 共通:
  - `additionalProperties=false` で受け取る。
  - 文字数上限（例: `text`/`label`/`rationale`）を超える場合は切り詰めまたは不採用。
- 免疫マップ:
  - `group` と `id` の整合（`B` グループは `B1..`）
  - 参照先が存在する `edge` のみ採用
  - 許可されない接続は破棄（必要なら再試行）

## 7. Mermaid 生成

- `flowchart TD` を基本とする（必要なら UI で LR へ切り替え）。
- A～F は `subgraph` で囲み、**該当カテゴリにノードが 1 件以上ある場合のみ**出力する。
- ノードのラベルは Mermaid 文字列として安全に出力する（`"` のエスケープ、改行の `<br/>` 置換等）。
- **空ノード/空エッジ/空カテゴリは出力しない**（要件）。

## 8. フロントエンド設計（案）

- 既存の A 手入力フォームを「候補カード選択」に置換する。
- 画面要素（例）:
  - A 候補カード一覧（kind バッジ、理由、根拠）
  - 生成ボタン（既定で 1 件選択済み）
  - （任意/上級）候補編集・手入力、期間/参照元の切り替え
  - 読み解きカード（観察/仮説/障壁/次の一歩）
  - Mermaid 出力（コード表示 + コピーボタン）
  - Mermaid Live Editor を開くリンク

## 9. 互換性（段階移行）

- `POST /analysis/immunity-map` の `a_items` による手入力フローは当面維持し、UI 側で「上級: 手入力モード」として残す（参照データ不足時のフォールバックにも使う）。

