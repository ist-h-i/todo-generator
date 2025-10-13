**背景**
- 目的: セレクターをモダン化し、ダークモードで下向きアローが背景と同化する問題を解消する
- 文脈: リポジトリは Angular 構成。React/shadcn 向けの Select 実装が提示されたが、最小変更の方針により既存 Angular 実装を改善
- 主要課題: ダークモードでトリガー文字色とアイコン色が不一致（アイコンが薄く見える）

**変更概要**
- 共有コンポーネントのアイコン色をテキスト色に揃えるよう統一
  - `.ui-select__icon` の `color` を `currentColor` に変更（アイコンが常に親の文字色を継承）
  - コンポーネント内の SVG は `stroke="currentColor"` のため、暗色/明色テーマで自動追従
- 既存のネイティブ `<select>` のグローバルスタイルはすでに `currentColor` ベースの矢印のため変更なし
- 挙動変更なし・テンプレ/TS 変更なし・スコープ極小

**影響**
- ダークモードでアイコンが背景に溶ける問題を解消
- ホバー/フォーカス/無効などの状態表現は維持
- 変更箇所は共通 UI セレクターのみで副作用が小さい

**検証**
- ビルド: `cd frontend && npm ci && npm run build` もしくは `ng build --configuration production`
- 手動確認（ライト/ダーク両方）:
  - 共有セレクターのトリガーで、テキストと下向きアローの色が一致すること
  - フォーカスリング、ホバー、無効状態でのコントラスト維持
  - 複数箇所（レポート/管理などの画面）でアイコンが視認できること
  - マルチセレクトや `size > 1` のバリアントに影響がないこと

**レビュー観点**
- ダークモード時の色コントラスト（WCAG AA 以上）を満たしているか
- 文字色トークン変更時にアイコンも追随すること（`currentColor` 継承）
- 既存ページのネイティブ `<select>` に回 regressions がないこと
- 可能なら high-contrast（forced-colors）環境での視認性も確認

**補足（shadcn/React 統合について）**
- 現状は Angular アプリのため、React/shadcn の導入は未実施（最小変更のため）
- 将来 React サブアプリを追加する場合:
  - コンポーネント配置: `components/ui`
  - ユーティリティ: `lib/utils.ts`（`cn`）
  - 依存: `@radix-ui/react-select`, `@radix-ui/react-icons`
  - 提示コードは `components/ui/select.tsx` と `components/ui/label.tsx` に配置して使用可能

以上により、ダークモード時のアイコン視認性問題は、最小の差分で解消済みです。