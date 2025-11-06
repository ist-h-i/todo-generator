**背景**
- 画面ごとにセレクターの見た目が不一致。基準は「コンピテンシーレベル」と「AIモデル選択」。
- 最小変更で全体のセレクターを統一し、既存のデータフローやAPIは触らない方針。

**変更概要**
- 単一選択は既存の `app-ui-select` を継続使用。ネイティブは `class="form-control app-select"` で統一。
- ページ局所の入力スタイルが `.app-select` を上書きしないよう調整（Board のみ変更）。
  - `frontend/src/styles/pages/_board.scss:653` `.subtask-editor__input` → `.subtask-editor__input:not(.app-select)`
  - `frontend/src/styles/pages/_board.scss:667` `.subtask-editor__input:focus-visible` → `.subtask-editor__input:not(.app-select):focus-visible`
  - `frontend/src/styles/pages/_board.scss:1148` `.dark .board-page .subtask-editor__input` → `.dark .board-page .subtask-editor__input:not(.app-select)`
- 仕様変更なし（ロジック・API変更ゼロ／依存追加なし）。ライト/ダーク両テーマでトークンに準拠。

**影響**
- 見た目とインタラクションが全画面で一貫（半径・余白・フォーカス・ホバー・無効状態）。
- Board のサブタスク用セレクトが他画面と同じトーンに揃う。
- `app-ui-select` のキーボード操作・ARIAは現状維持。ネイティブ `<select>` はブラウザ既定のアクセシビリティ維持。
- 破壊的変更は想定なし。局所CSSの優先度が下がるため、意図的なカスタム見た目があれば要確認。

**検証**
- 参照元と比較して視覚一致を確認
  - 管理: `frontend/src/app/features/admin/feature/admin-page.component.html:127`, `:498`
  - 共通スタイル: `frontend/src/styles/pages/_base.scss:85`
- ステート確認（ネイティブ/カスタム双方）
  - Hover/Focus-visible/Disabled が一致（ライト/ダーク）。
- 振る舞い
  - `app-ui-select` の矢印/Enter/Esc 操作、選択反映、パネル開閉。
  - 複数選択・size 指定はネイティブ `.app-select`（キャレット非表示・余白調整）。
- 回帰
  - Board のサブタスクセレクトが `.app-select` 見た目で表示されること（`frontend/src/styles/pages/_board.scss:653`）。

**レビュー観点**
- 最小差分で統一されているか（Board 以外で `.app-select` を上書くCSSが残っていないか）。
- 参照画面（コンピテンシー/モデル選択）の見た目が変わっていないか。
- 残リスク
  - 他ページにも似た局所オーバーライドが潜在する可能性（発見時は同様に `:not(.app-select)` 適用）。
  - サードパーティコンポーネントは `.app-select` を非適用。
  - RTL 環境でのキャレット位置・余白（`right` ベース）に未対応。
  - `app-ui-select` のエラー可視化（`aria-invalid`/`aria-describedby`）は未定義。
  - 動作アニメーションの `prefers-reduced-motion` 非対応。
- オープンクエスチョン
  - `app-ui-select` にコンボボックスセマンティクス（`role="combobox"`/`aria-activedescendant`）を今入れるか後回しか。
  - フィールドレベルのエラー表示/ARIAを即時対応すべきか。
  - RTL 対応をこのIssue範囲に含めるか。