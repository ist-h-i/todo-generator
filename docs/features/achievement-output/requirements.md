# 実績出力 (Achievement Output) Requirements

## Document Control

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Author | Product / Engineering |
| Last Updated | 2025-12-31 |
| Status | Draft |

## 1. Background & Objectives

実績をレポートや面談資料へ転記する際、文章の構成・トーン・因果関係の示し方が個人差でブレやすく、作成にも時間がかかる。
「実績出力」は、ユーザーの実績（カード）を材料に、因果関係を明示した文章を複数形式で同時生成し、編集・コピー・エクスポートしやすい状態で提供する。

本機能は UI 上のタイトルを「実績出力」とするが、バックエンドの既存 API（`/appeals`）を利用して実装する（API 名称の変更は別途検討）。

### Objectives

1. 実績出力の入口をヘッダーに追加し、迷わず到達できるようにする。
2. 推奨フロー（例: 課題→対策→実績→所感）に沿った“因果が伝わる”文章を生成する。
3. Markdown / 箇条書き / CSV の3形式を同時に生成し、用途に応じて使い分けられるようにする。
4. AI が利用できない場合でも、フォールバック文面で作業が止まらないようにする。

## 2. Success Metrics

| Metric | Target | Measurement |
| --- | --- | --- |
| 出力結果の利用率 | 生成後にコピー/ダウンロードが行われる割合が上昇 | `achievement_output.copy` / `achievement_output.download` |
| 生成体験の待ち時間 | p95 8 秒以内 | API レイテンシログ |
| フォールバック率 | 監視可能で、意図しない増加を検知できる | `formats[].tokens_used` / API ログ |

## 3. Scope

### In Scope (MVP)

- ヘッダーの「コンピテンシー」メニュー右隣に「実績出力」を追加する。
- 実績出力ページで以下を提供する:
  - subject（テーマ）の選択（ラベル / 自由入力）
  - フロー（最大5ステップ）の編集（推奨フローを初期値にする）
  - 出力形式の選択（`markdown`, `bullet_list`, `table`）
  - 生成結果の表示（タブ切替）とコピー/ダウンロード
  - API が返す `warnings` の表示
  - 429（上限到達）等のエラー表示

### Out of Scope (for now)

- プロンプトテンプレート編集 UI
- PDF などのリッチな書き出し
- 複数ラベルをまとめた subject
- カード全件からの実績検索（MVP は `/appeals/config` が返す範囲の実績プレビューを前提）
- 生成履歴 UI（現状 API がフロント向け一覧取得を提供していないため、将来対応）

## 4. Personas

| Persona | Goals | Key Needs |
| --- | --- | --- |
| メンバー | 面談/自己評価用に短時間で文章化 | 推奨フロー、編集しやすい出力 |
| リード/マネージャ | 報告書の粒度と構成の標準化 | 因果の明確さ、複数形式 |
| CS/提案担当 | 実績を対外資料へ転用 | CSV/Markdown の再利用 |

## 5. User Stories & Acceptance Criteria

1. **Navigation**
   - ユーザーはヘッダーから「実績出力」を選択してページを開ける。
   - 「実績出力」は「コンピテンシー」の右隣に表示される。

2. **Config Retrieval**
   - ページ初期表示で `GET /appeals/config` を呼び、ラベル一覧・推奨フロー・形式定義を取得する。
   - 取得中はローディング状態を表示し、失敗時は再試行導線を提供する。

3. **Generation**
   - ユーザーは subject / flow / formats を指定して生成を実行できる。
   - `POST /appeals/generate` 成功時、生成結果が表示される。
   - `warnings` があれば UI に表示される（例: 因果が伝わりづらいフロー）。
   - AI 生成が失敗しフォールバックした場合、その旨と（可能なら）理由を UI に表示する（ホバー等）。

4. **Editing & Export**
   - 各形式の出力はコピーできる。
   - `markdown` は `.md` としてダウンロードできる。
   - `bullet_list` は `.txt` としてダウンロードできる。
   - `table` は `.csv` としてダウンロードできる（改行を含まない前提）。

5. **Rate Limit**
   - 429 の場合、上限に達した旨を明示する。
   - （将来）残り回数の事前表示を検討する。

## 6. Functional Requirements

### 6.1 UI / Routing

- SPA ルート（案）: `/achievement-output`
- ヘッダー: `ShellPage.navigationLinks()` の配列で「コンピテンシー」の直後に挿入する。
- AI 機能として表示する（メニューに AI マークが付く想定）。

### 6.2 Backend Contract (existing)

- Config
  - `GET /appeals/config`
  - Response: `labels[]`, `recommended_flow[]`, `formats[]`
- Generate
  - `POST /appeals/generate`
  - Request: `subject`, `flow[]`, `formats[]`, `achievements[]?`
  - Response: `generation_id`, `subject_echo`, `flow[]`, `warnings[]`, `formats{ [id]: { content, tokens_used? } }`

### 6.3 Content Rendering

- 生成結果は HTML としてレンダリングせず、プレーンテキストとして扱う（XSS/意図しない DOM 生成を避ける）。
- Markdown は「プレビュー」よりも「編集・コピー」を優先（MVP）。

## 7. Non-Functional Requirements

- **Security**: subject/achievements はバックエンドでマスキング・エスケープされる前提だが、フロントでも HTML として解釈しない。
- **Accessibility**: タブ/ボタンはキーボード操作可能、状態（生成中/失敗/成功）を適切に付与する。
- **Reliability**: AI が未設定/失敗でもフォールバック結果を返すため、UI は“結果を表示して編集できる”ことを最優先にする。

## 8. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| 実績の選択自由度が不足 | MVP は config で提示される実績プレビューを前提にし、将来 API 拡張（実績検索/選択）を検討 |
| 生成内容が一般的すぎる | 推奨フローと実績要約を明示し、編集 UI を充実させる |
| レート制限で利用が止まる | 429 の理由表示と、将来の残り回数表示（クォータ API）を検討 |

## 9. Open Questions

- SPA の最終ルート名（`/achievement-output` か `/outputs/achievements` 等）
- 生成履歴を UI で見せる要否（API 追加: `GET /appeals/recent` など）
- 実績の検索/選択 UI をどの段階で導入するか（バックエンド API 拡張含む）
