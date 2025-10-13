**背景**
- 目的: ダークモード時、セレクター内の下向きアローが背景と同化し視認性が低い問題を解消
- 前提: リポジトリは Angular 構成（React/shadcn ではない）。最小変更・スタイル中心で全体適用
- 対象: ネイティブ `<select>`（`.app-select`, `select.form-control`）と共有 Angular セレクター（`ui-select`）

**変更概要**
- アイコン色の継承を統一（currentColor）
  - セレクターのキャレット（CSS 背景のシェブロン）を `currentColor` で描画し、テキスト色に追従
    - `frontend/src/styles/pages/_base.scss:85, :101, :112`
  - ダークモードでトリガーの文字色を高コントラストのテーマトークンに明示
    - `frontend/src/styles/pages/_base.scss:164`（例: `color: var(--text-primary);`）
- 共有 Angular セレクターのアイコンも同様に継承
  - `.ui-select__icon { color: currentColor; }` とし、SVG は `stroke="currentColor"`
  - ダークモードでトリガーに文字色を適用（アイコンが同色化）
    - `frontend/src/app/shared/ui/select/ui-select.ts:171`
- 付随対応（ビルドブロッカー解消のみ、挙動不変）
  - `onTouched()` を template から呼べる公開化（TS2341）
  - null 安全な選択値判定に整理（TS2531）
    - `frontend/src/app/shared/ui/select/ui-select.ts:278`

**影響**
- ダークモードで下向きアローが文字色と揃い、背景と同化せず明瞭に表示
- ホバー/フォーカス/無効状態の表現は維持。多選択や `size > 1` のバリアントは非表示のまま
- 変更は集中（SCSS + 既存 UI コンポーネントの最小スタイル）で副作用は限定的

**検証**
- ビルド: `cd frontend && npm ci && npm run build`（または `ng build --configuration production`）
- 手動確認（ライト/ダーク）
  - テキストとアローの色が一致し、十分なコントラストがあること
  - フォーカスリング・ホバー・無効状態の視認性
  - 複数画面での一貫性: `frontend/src/app/features/settings/page.html:249, :428`、`frontend/src/app/features/board/page.html:565, :730`、`frontend/src/app/features/reports/reports-page.component.html:255, :274`
  - マルチ/`size>1` でキャレット非表示、パディング崩れがないこと

**レビュー観点**
- コントラスト: ダークモードで背景に対して十分か（WCAG 目安）
- 継承: `currentColor` に統一され、局所上書きが不整合を起こしていないか
- 回帰: セレクトの高さ/パディング/縦中央揃え（`background-position: right <offset> center`）が崩れていないか
- 追加検討（任意・別Issue）
  - RTL 対応（必要なら caret 位置を論理プロパティ化）
  - 強制ハイコントラスト環境での見え方（`@media (forced-colors: active)` で背景アイコン抑制）