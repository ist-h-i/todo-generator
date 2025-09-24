# UI デザイン再設計ガイド

## 背景と課題
- カードボード画面ではメトリクス、フィルター、ドラッグ＆ドロップ列が個別に組まれており、ヘッダーや操作チップのレイアウトが他画面と共有されていません。【F:frontend/src/app/features/board/page.html†L1-L210】
- 分析ダッシュボードは共有コンポーネントの `app-page-header` を用いているものの、統計カードやフィルター群の見た目・余白が他ページのセクションと揃っておらず、アクセントカラーの使い方も独自です。【F:frontend/src/app/features/analytics/page.html†L1-L200】
- 日報・週報解析は独自の `page-title` とサイドバー構成で、同じフォーム要素でもボタンやフィードバックのスタイルが他画面と異なるため、フォーム体験に一貫性がありません。【F:frontend/src/app/features/daily-reports/page.html†L1-L152】
- ワークスペース設定や管理コンソールは一覧・フォームを個別レイアウトで構築しており、共通のセクションやバッジの扱いがページごとにばらついています。【F:frontend/src/app/features/settings/page.html†L1-L240】【F:frontend/src/app/features/admin/page.html†L1-L200】
- プロフィール評価や認証フローも独自のヘッダー・ボタン設計を持ち、ページ遷移時に視覚トーンが変わってしまいます。【F:frontend/src/app/features/profile/evaluations/page.html†L1-L200】【F:frontend/src/app/features/auth/login/page.html†L1-L200】

## 目的と設計原則
1. **視覚的一貫性** – 共通トークンとコンポーネントで色・余白・角丸・影を揃え、画面ごとの文脈だけを差分として表現する。
2. **情報の階層化** – ページヘッダーで文脈、サーフェスパネルで主要操作、カード／リストで詳細を段階的に提示する。
3. **操作性の維持** – 既存のフォームやドラッグ操作をそのまま活かしつつ、新しい見た目を段階的に適用できる構造にする。
4. **アクセスビリティ** – フォーカスリング、ARIA 属性、読み上げ順が各ページで統一されるよう、共通部品にガイドラインをまとめる。

## ビジュアルファウンデーション
- **カラートークン** – 既存の `:root` と `.dark` に定義されたサーフェス、テキスト、アクセント、フィードバック色を唯一のカラーパレットとし、画面固有の色指定はアクセントトークンの組み合わせで行う。【F:frontend/src/styles.scss†L15-L136】
- **タイポグラフィ** – ベースフォントは `Inter` と `Noto Sans JP` の組み合わせを採用し、ルートの 80% フォントサイズを基準に見出し・本文のサイズスケールを設定する。本文はデフォルトの `body` 定義、見出しは後述のヘッダー／セクションコンポーネントに従う。【F:frontend/src/styles.scss†L138-L150】
- **スペーシング・角丸** – `--panel-padding`、`--panel-gap`、`--radius-lg`/`--radius-xl` のトークンを用い、要素間隔は `clamp` ベースの変数で統一する。各ページで独自の余白を設定せず、トークンの上書きが必要な場合はページルートで限定的に行う。【F:frontend/src/styles.scss†L70-L76】【F:frontend/src/styles/pages/_base.scss†L1-L40】
- **サーフェスと影** – `surface-panel`、`surface-card`、`surface-pill` クラスで角丸・グラデーション・シャドウを統一し、情報の階層に応じて使い分ける。フォームや統計カードもこのレイヤー上で表現する。【F:frontend/src/styles.scss†L213-L235】

## レイアウトシステム
- **アプリシェル** – 各画面のルートは `.app-page` を用い、上下余白を共通トークンから取得する。主コンテンツブロックは `page-panel` または `page-section` に収めて視覚的一貫性を確保する。【F:frontend/src/styles/pages/_base.scss†L1-L120】【F:frontend/src/styles/pages/_base.scss†L323-L352】
- **ページヘッダー** – ページ導入部は `app-page-header`（Angular コンポーネント）または `.page-header` スタイルを必ず利用し、眉（eyebrow）、タイトル、説明、アクションの配置を共通化する。必要に応じて `headingLevel` 入力で見出し階層を調整する。【F:frontend/src/app/shared/ui/page-header/page-header.html†L1-L28】【F:frontend/src/app/shared/ui/page-header/page-header.scss†L1-L38】
- **グリッドとレスポンシブ** – 2 カラム構成が必要なページは `page-grid page-grid--two` と `form-grid--two` を用い、ブレークポイントに応じて縦積みに戻す。ドラッグ領域や詳細パネルはグリッド内のカラムとして配置し、同じ余白・角丸を適用する。【F:frontend/src/styles/pages/_base.scss†L515-L533】【F:frontend/src/styles/pages/_base.scss†L625-L633】
- **補助レイアウト** – タブ、トグル、空状態、バッジなどは `_base.scss` の `page-tabs`、`form-toggle`、`page-state`、`page-badge` を利用し、任意のページで同一動作・見た目を実現する。【F:frontend/src/styles/pages/_base.scss†L274-L321】【F:frontend/src/styles/pages/_base.scss†L530-L623】【F:frontend/src/styles/pages/_base.scss†L417-L449】

## コアコンポーネント仕様
- **ボタン** – `.button` 系クラスを標準化し、主要動作は `button--primary`、サブは `button--secondary`、テキストのみは `button--ghost` を採用する。ボードや認証画面で独自に指定しているボタンはこのスタイルに移行する。【F:frontend/src/styles/pages/_base.scss†L451-L507】
- **フォーム** – `.form-field` と `.form-control`、`.form-collection` を組み合わせ、入力・テキストエリア・集合フォームは共通余白とフォーカス挙動を持つ。バリデーション表示は `.form-feedback` を用いて統一し、既存の ARIA 属性は維持する。【F:frontend/src/styles/pages/_base.scss†L27-L156】【F:frontend/src/app/features/auth/login/page.html†L20-L190】
- **カード / パネル** – データサマリーは `surface-panel`、詳細アイテムは `surface-card` をベースに、タイトル、メタ情報、ラベルを `board` や `analytics` と同じ順序で配置する。ドラッグ可能なカードも視覚構造は `surface-card` を継承し、インタラクションスタイルのみ個別に付与する。【F:frontend/src/app/features/board/page.html†L167-L240】【F:frontend/src/app/features/analytics/page.html†L32-L178】
- **チップ / バッジ** – フィルターや ID 表示は `surface-pill` と `page-badge` を使い分け、アクセント色が必要な場合は `page-badge--accent` などを適用する。設定画面のラベルやテンプレート ID も同一スタイルに揃える。【F:frontend/src/styles.scss†L228-L250】【F:frontend/src/styles/pages/_base.scss†L417-L437】【F:frontend/src/app/features/settings/page.html†L167-L220】
- **タブ / トグル** – 管理コンソールで利用するタブやトグルは `_base.scss` の定義を標準とし、他画面でタブ切り替えが必要な場合も同じクラスを適用する。【F:frontend/src/app/features/admin/page.html†L27-L120】【F:frontend/src/styles/pages/_base.scss†L274-L356】
- **テーブル / リスト** – リスト項目は `page-list`、テーブルは `page-table__wrapper` と `page-table` を使用し、列ヘッダーやメタ情報のタイポグラフィを統一する。設定・管理・分析レポートに同じスタイルを適用する。【F:frontend/src/styles/pages/_base.scss†L361-L590】
- **アラート / ステート** – 成功・エラーなどのフィードバックは `app-alert` と `page-state` を利用し、アクセントカラーに依存しない読みやすい配色で統一する。【F:frontend/src/styles/pages/_base.scss†L188-L213】【F:frontend/src/app/features/admin/page.html†L9-L25】

## インタラクションとアクセシビリティ
- **フォーカスリング** – `.focus-ring` のユーティリティでフォーカスの見え方を統一し、全ボタン・インタラクティブ要素に適用する。色覚多様性に配慮したコントラストの確保を必須とする。【F:frontend/src/styles.scss†L252-L260】
- **ARIA / ライブリージョン** – 認証や評価画面が持つ `aria-live`、`aria-invalid` 属性を共通フォームコンポーネントでも保持できるようにし、バリデーション／ステータスメッセージが読み上げられる構造を維持する。【F:frontend/src/app/features/profile/evaluations/page.html†L12-L92】【F:frontend/src/app/features/auth/login/page.html†L20-L190】
- **ドラッグ＆ドロップ** – カードボードの CDK ドラッグ機能は視覚的に強調しすぎず、カード背景や枠線のアクセント濃度で状態を示す。アクセシブルな代替操作（メニューによるステータス変更）も保持する。【F:frontend/src/app/features/board/page.html†L167-L240】

## 画面別適用方針
### カードボード
1. ページ冒頭に `app-page-header` を配置し、現状のタイトル・フィルタサマリーをヘッダーアクションへ統合する。【F:frontend/src/app/features/board/page.html†L49-L156】
2. フィルター列は `surface-panel` を利用した 2 カラムの `page-grid--two` に再構成し、検索、表示形式、クイックフィルターを統一パターンで並べる。
3. カード列とサブタスク列は同一 `board-columns` グリッドを維持しつつ、ヘッダーとカードの装飾を `surface-card` 基準に揃える。

### AI タスク起票（Analyze）
1. フォーム全体を `page-grid--two` に切り分け、ノート入力とゴール設定を並列に配置する。【F:frontend/src/app/features/analyze/page.html†L1-L120】
2. 推奨度やサブタスク案のカードは `surface-panel` を継承し、ステータス／ラベル推奨は `surface-pill` で表現する。
3. エラー・読み込み表示は `app-alert` と `page-state` を共通使用し、トースト的な色分けを避けて読みやすさを優先する。【F:frontend/src/app/features/analyze/page.html†L120-L200】

### 分析ダッシュボード
1. 統計サマリーやリストは `surface-panel` + `page-list` を採用し、カード余白と角丸をボード・設定画面と揃える。【F:frontend/src/app/features/analytics/page.html†L32-L178】
2. スナップショットチップや推奨アクションは `surface-pill` を使い、選択状態は `surface-primary-muted` で表現する。
3. コンピテンシー評価リンクなどのアクションは `appPageHeaderActions` スロットに寄せ、ページ導線の一貫性を担保する。【F:frontend/src/app/features/analytics/page.html†L1-L30】

### 日報・週報解析
1. 既存のフォームと解析結果サイドバーを `page-grid--two` の 2 カラムに配置し、双方 `surface-panel` で装飾する。【F:frontend/src/app/features/daily-reports/page.html†L1-L152】
2. 解析結果のカードやイベント履歴は `page-list` / `surface-card` に統一し、タイトル、優先度、サマリーを共通レイアウトで表示する。
3. 成功・エラーメッセージは `app-alert` スタイルへ変更し、フォーム下部に集約してフィードバック位置を固定する。

### ワークスペース設定
1. 上部ヘッダーに `app-page-header` を挿入し、現在 `page-section` 内にある説明をヘッダー説明へ移す。【F:frontend/src/app/features/settings/page.html†L1-L32】
2. ステータス／ラベル／テンプレート一覧は `page-list` パターンを活用し、メタ情報やアクションボタンを共通配置に揃える。【F:frontend/src/app/features/settings/page.html†L17-L220】
3. 追加フォームは `form-grid` と `button--primary` を利用し、二重線や点線境界は `_base.scss` のフォームスタイルへ統合する。

### 管理コンソール
1. ヒーローセクションを `app-page-header` ベースへ置き換え、タブメニューをその直下に配置する。【F:frontend/src/app/features/admin/page.html†L1-L64】
2. 各タブの内容は `page-section` / `page-list` / `form-grid` に合わせ、判定履歴やユーザ管理などのテーブルは `page-table` を利用する。【F:frontend/src/app/features/admin/page.html†L66-L200】
3. アラートとトグルは `_base.scss` の共通定義へ揃え、アクセント色の過剰使用を避ける。

### コンピテンシー評価
1. ヘッダーを `app-page-header` コンポーネントに置き換え、評価実行ボタン群は `appPageHeaderActions` スロットで整理する。【F:frontend/src/app/features/profile/evaluations/page.html†L1-L68】
2. 最新評価カードと詳細リストは `surface-panel` / `surface-card` を利用し、スコアや推奨アクションを共通タイポグラフィで整列させる。【F:frontend/src/app/features/profile/evaluations/page.html†L110-L200】
3. 空状態・エラー・ローディングは `page-state` と `app-alert` を統一的に使用する。【F:frontend/src/app/features/profile/evaluations/page.html†L71-L109】

### 認証フロー
1. ログイン・新規登録カードのヘッダーを `app-page-header` に揃え、フォームボタンは `.button--primary` / `.button--secondary` を適用する。【F:frontend/src/app/features/auth/login/page.html†L1-L200】
2. フォームフィールドは共通 `form-field` スタイルをそのまま活用し、バリデーションメッセージの位置・色を統一する。
3. 補助説明やヒントは `page-list` / `page-badge` を用いて視覚的に整理し、アクセントカラーの乱立を避ける。

## 実装ロードマップ
1. **デザイントークン整理** – `styles.scss` と `_base.scss` を確認し、未使用トークンの整理とコメント整備を行う（変更の影響が大きいため最初に合意形成）。【F:frontend/src/styles.scss†L15-L260】【F:frontend/src/styles/pages/_base.scss†L1-L640】
2. **共通コンポーネント拡張** – `app-page-header` にアクションスロット、サブタイトル、補助テキストのパターンを追加し、`surface-panel` などのユーティリティクラスを Angular コンポーネントから使いやすいよう整理する。【F:frontend/src/app/shared/ui/page-header/page-header.html†L1-L28】
3. **フォーム／ボタンの統合** – 認証・日報・設定フォームで `.button` と `.form-field` を導入し、余白やバリデーションの見た目を揃える。段階的に画面ごとにコミットしてリグレッションを防ぐ。【F:frontend/src/app/features/daily-reports/page.html†L1-L152】【F:frontend/src/app/features/settings/page.html†L1-L220】
4. **データ表示パターンの適用** – ボード、分析、評価のカード／リストを `surface-panel` / `page-list` に置き換え、追加で必要なバリエーション（ステップカード、統計カードなど）をデザイン定義する。【F:frontend/src/app/features/board/page.html†L1-L240】【F:frontend/src/app/features/analytics/page.html†L32-L200】
5. **画面単位での移行** – 影響範囲が小さいページ（認証 → 日報 → 分析 → ボード → 設定 → 管理 → プロフィール）の順に適用し、各ステップで E2E/ユニットテストと手動確認を行う。
6. **QA とアクセシビリティ検証** – フォーカス遷移、キーボード操作、ダークテーマ表示を画面ごとに確認し、不整合があればトークンまたはコンポーネント定義へフィードバックする。

## ドキュメンテーションと運用
- 本ガイドを `docs` ディレクトリに保守し、UI 変更時は該当セクションへ追記する。
- 新規画面を追加する際は「背景」→「レイアウト」→「コンポーネント」→「アクセシビリティ」の順でガイドライン準拠を確認するチェックリストを運用する。
- デザイン変更は `design-review` ラベルの Issue / PR で議論し、主要コンポーネントの Storybook 化（将来の導入想定）を検討して UI 回帰を防ぐ。
