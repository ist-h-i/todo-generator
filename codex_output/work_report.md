**背景**
- 目的: セレクターをモダン化し、ダークモードでの視認性を改善
- 現状: リポジトリは Angular 構成（React/shadcn ではない）。共通セレクターは `frontend/src/app/shared/ui/select/ui-select.ts` に実装
- ブロッカー: TypeScript エラー TS2531（null 可能な `this.value` に対して `includes` を呼び出し）により CI が停止

**変更概要**
- TS 安全化: 選択値を正規化した安全な配列に変換してから判定
  - 例: `const selected = Array.isArray(this.value) ? this.value : this.value != null ? [String(this.value)] : [];` → `selected.includes(o.value)`
  - 修正対象: `frontend/src/app/shared/ui/select/ui-select.ts:278`
- 公開性: テンプレートから呼ぶ `onTouched()` は public を維持（TS2341 再発防止）
- スタイル整備（既存反映の要旨）:
  - 下向きアローをシンプルなシェブロンに統一、Y 方向センタリング
  - アイコン色を `currentColor` に統一し、ダーク/ライトで文字色に追従
  - オプションパネルの半径・影・間隔をモダン寄りに調整（最小影響範囲で）

**影響**
- 挙動・API変更なし（型安全化のみ）。既存の単一/複数選択どちらにも対応
- ダークモードで矢印が背景と同化する問題を解消（文字色と同一化）
- 影響範囲は共有セレクターとグローバル select スタイルに限定（副作用小）

**検証**
- ビルド/テスト
  - `cd frontend && npm ci && npm run build`（または `ng build --configuration production`）
  - `npm test`（Karma が load error 0 で起動）
- 手動確認
  - 単一/複数選択のラベルが正しく同期される（null/未選択時もエラーなし）
  - ライト/ダークでテキストと矢印の色が一致
  - フォーカスリング、ホバー、無効状態のコントラストが維持
  - 主な画面（レポート/管理/設定）での視認性を確認

**レビュー観点**
- 型安全: `this.value` が `string | string[] | null` でも常に配列化してから `includes` 使用
- 互換性: 値が非文字型でも `String(...)` で比較を安定化（既存表示と同等）
- デザイン: アイコン `currentColor` 化でテーマ追従、余白/半径/影は既存トークンと整合
- リスク/残課題: RTL と強制ハイコントラスト対応は最小変更のため未深掘り（必要なら追補可）