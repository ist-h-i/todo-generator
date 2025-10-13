**背景**
- 目的: セレクターのホバー時に背景が白っぽくなる不整合を解消し、他の input と統一
- 併せて: 下向きアローをシンプル化し、ダークモードでも文字色と同一で視認性を確保
- 前提: リポジトリは Angular 構成。最小変更方針でスタイル中心に対応

**変更概要**
- ホバー統一: セレクターの hover 背景色をベースと同一にし「白浮き」を解消
  - 対象: `.app-select`, `select.form-control`（中央スタイルで全体適用）
  - 反応性は維持: 境界色/影の微変更でホバーの手触りは残す
- アイコン統一: 下向きアローは `currentColor` で描画し、文字色と常に一致（ライト/ダーク両対応）
- 型安全性（ビルド安定化）: `this.value` の null 安全化（配列正規化）と `onTouched()` の公開化
- 代表ファイル
  - ホバー調整: `frontend/src/styles/pages/_base.scss:129`
  - 型安全/公開化: `frontend/src/app/shared/ui/select/ui-select.ts:278`, `frontend/src/app/shared/ui/select/ui-select.ts:34`

**影響**
- アプリ全体でセレクターの見た目が input と統一（ライト/ダーク両方）
- 下向きアローが背景に溶けず、常にテキストと同コントラストで可読
- 機能/API/テンプレート変更なし。影響範囲は CSS と最小の TS 安全化のみ

**検証**
- ビルド: `cd frontend && npm ci && npm run build`（または `ng build --configuration production`）
- 手動確認（ライト/ダーク）
  - ホバーで背景が白っぽくならず、他の input と同じ挙動
  - フォーカスリングの可視性、無効状態の見た目を維持
  - 矢印アイコンが文字色と一致し視認性良好
  - マルチ/`size>1` はキャレット非表示のまま
- 代表画面
  - `frontend/src/app/features/settings/page.html:249`
  - `frontend/src/app/features/board/page.html:565`
  - `frontend/src/app/features/reports/reports-page.component.html:274`

**レビュー観点**
- 局所オーバーライドがあれば見た目差分が出ないか（最小の特異性で中央スタイルが勝つはず）
- RTL/forced-colors は本対応の対象外（必要ならフォローアップで対応可）
- React/shadcn 提供コードは本リポ構成（Angular）と不一致のため未採用。必要なら別タスクでセットアップ方針を提示可能