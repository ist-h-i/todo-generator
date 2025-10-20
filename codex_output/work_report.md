**背景**
- 既存のセレクターでホバー時に背景が白っぽくなり、他の input と不統一。
- 下向きアローがホバーまで見えにくい／見えない箇所があり、ダークモードで背景と同化。
- リポジトリは Angular 構成。最小変更方針により中央の SCSS と共有 UI セレクターのみを調整。
- React/shadcn のコンポーネント統合は本リポジトリの技術選定外のため不採用（最小差分を優先）。

**変更概要**
- セレクターの基礎スタイルを inputs と統一（背景/枠/半径/密度/状態）
  - 対象: `.app-select`, `select.form-control`（アプリ全体に反映）
  - 常時表示の極細シェブロンを `currentColor` で描画、Y方向センタリングと右余白を調整
  - 参照: `frontend/src/styles/pages/_base.scss:85`, `frontend/src/styles/pages/_base.scss:94`, `frontend/src/styles/pages/_base.scss:113`
- ホバーで白くならないよう背景は据え置き、境界/影でフィードバック
  - 参照: `frontend/src/styles/pages/_base.scss:118`（もしくは `:129`）
- フォーカス/無効/複数選択/size>1 の各状態を統一、複数系はキャレット非表示
  - 参照: `frontend/src/styles/pages/_base.scss:128`, `frontend/src/styles/pages/_base.scss:155`
- ダークモードの視認性を確保（テキスト色とアイコン色を一致）
  - 参照: `frontend/src/styles/pages/_base.scss:165`, `frontend/src/styles/pages/_base.scss:184`, `frontend/src/styles/pages/_base.scss:204`, `frontend/src/styles/pages/_base.scss:213`, `frontend/src/styles/pages/_base.scss:220`
- 共有 Angular セレクター（トリガー/アイコン/パネル）の整合
  - アイコンは `currentColor` 継承で常時可視化、パネルは丸み/影/間隔をモダン化
  - 参照: `frontend/src/app/shared/ui/select/ui-select.ts:34`, `frontend/src/app/shared/ui/select/ui-select.ts:84`, `frontend/src/app/shared/ui/select/ui-select.ts:122`, `frontend/src/app/shared/ui/select/ui-select.ts:171`
- 型安全の付随修正（ビルド安定化・挙動不変）
  - `onTouched()` 公開化、選択値の null 安全化
  - 参照: `frontend/src/app/shared/ui/select/ui-select.ts:34`, `frontend/src/app/shared/ui/select/ui-select.ts:278`

**影響**
- アプリ全体でセレクターの見た目が input と統一（ライト/ダーク両対応）。
- 下向きアローは常時見え、テキスト色と同コントラストで視認性向上。
- 挙動/API の変更なし。影響は CSS と最小限の TS 安全化に限定。

**検証**
- ビルドとスモークテスト: `cd frontend && npm ci && npm run build`
- 画面確認（抜粋）
  - `frontend/src/app/features/settings/page.html:249`, `frontend/src/app/features/settings/page.html:428`
  - `frontend/src/app/features/board/page.html:565`, `frontend/src/app/features/board/page.html:730`
  - `frontend/src/app/features/reports/reports-page.component.html:255`, `frontend/src/app/features/reports/reports-page.component.html:274`
- チェックリスト
  - ホバーで背景が白化しない／inputs と同一の表現
  - アイコンが常時可視、ライト/ダークで文字色と一致
  - `:focus-visible` のリングと無効状態の視認性
  - `multiple`/`size>1` でキャレット非表示・余白適正

**レビュー観点**
- コントラスト比（ダーク/ライト）、キーボードフォーカスの可視性
- 既存ページ固有のオーバーライドとの干渉（特に `select.form-control`）
- 物理 `right` 指定のまま（RTL はスコープ外）。必要なら論理プロパティへ移行
- 高コントラスト環境: 必要なら `@media (forced-colors: active) { .app-select, select.form-control { background-image: none; } }` を追補可能

以上により、「ホバー時の白化」「アイコンが見えない」「ダークモードでの同化」を解消し、インプットとセレクターのデザインを統一しました。
