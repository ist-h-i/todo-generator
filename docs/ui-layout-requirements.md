# Screen Layout Requirements

## Document Control
| Field | Value |
| --- | --- |
| Version | 1.0 |
| Author | Product Design Team |
| Last Updated | 2024-07-05 |
| Status | Draft |

## 1. Purpose & Background
最近のレビューで、画面ごとに余白の取り方が不揃いで、コンテンツの密度が高すぎる領域と間延びした領域が混在していることが判明した。利用者の視線移動や操作性を最適化するため、アプリ全体のレイアウト構造と余白ルールを再定義し、すべてのページで一貫したレイアウト体験を実現することを目的とする。

## 2. Guiding Principles
1. **Consistent Rhythm** – 8px グリッドを基準に倍数（8 / 16 / 24 / 32 / 40 / 56 / 72）で余白を構成し、明確なビジュアルリズムを作る。
2. **Priority-led Density** – 情報密度はコンテンツの優先度で決め、重要度が低い領域では余白を広く確保する。カード、フォーム、テーブルなどコンテンツタイプごとの密度を定義する。
3. **Aligned Interactions** – 操作エリア（ボタン・フィルタ・検索など）はアラインメントラインに揃え、左右の余白と高さを統一する。
4. **Responsive Continuity** – デスクトップ、タブレット、モバイルで同じ情報階層が伝わるよう、ブレークポイントごとにカラム幅とスタック順序を明示する。

## 3. Spacing & Sizing Tokens
| Token | Value | Usage |
| --- | --- | --- |
| `space-xxs` | 4px | アイコンとラベルなどの微調整 |
| `space-xs` | 8px | インライン要素間の間隔、フォームラベルとフィールド間 |
| `space-sm` | 12px | 小見出し周り、バッジ群の間隔 |
| `space-md` | 16px | コンポーネント間の標準余白、リストアイテムの上下 |
| `space-lg` | 24px | カード内部余白、セクションヘッダーとボディ |
| `space-xl` | 32px | セクション間、ページラッパー上下余白 |
| `space-2xl` | 40px | ページヘッダー下の余白、大きな分岐前 |
| `space-3xl` | 56px | ページ最下部とフッター間、ヒーローセクション |
| `space-4xl` | 72px | アプリケーションシェル外周（最大値） |

- ページ外周余白は `clamp(40px, 8vw, 72px)` とし、モバイルは 24px を上限とする。
- セクションヘッダーとコンテンツボディは `space-lg` を最小とし、説明文がある場合は `space-md` を追加する。
- コンポーネントの上下余白が 8px 未満になる配置は禁止する。

## 4. Breakpoints & Grid System
| Breakpoint | Width | Columns | Gutter | Margin |
| --- | --- | --- | --- | --- |
| Mobile | 0–599px | 4 | 16px | 24px |
| Tablet | 600–1023px | 8 | 20px | 32px |
| Desktop | 1024–1439px | 12 | 24px | 40px |
| Large Desktop | 1440px〜 | 12 | 32px | 72px |

- コンテンツは 12 カラムグリッドをベースにし、カード幅は `minmax(320px, 4col)` を基本とする。
- サイドバーを含む 2 カラム構成は Desktop 以上で `8col : 4col` を基準に、Tablet 以下では縦積み。
- グローバルヘッダーの高さは 64px 固定。影は使用せず 1px ボーダーで分離する。

## 5. Page Archetypes
### 5.1 Dashboard / Analytics Page
- **構成**: ページヘッダー、KPI カードグリッド、原因ツリー & 提案アクションの 2 カラム、レポート草案セクション。
- **余白**: ヘッダー下に `space-2xl`、各グリッド間 `space-xl`。
- **カードグリッド**: `grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))`、ギャップ `space-lg`。
- **原因ツリー & 提案アクション**: Desktop では `7col : 5col`、Tablet 以下ではスタック。スタック時の間隔は `space-xl`。

### 5.2 Board Page
- **構成**: ページヘッダー、フィルタバー、カンバンボード。
- **フィルタバー**: 上下余白 `space-md`、要素間 `space-md`、最後尾アクションは右揃えで折り返し時も 2 行目開始位置を揃える。
- **ボード列**: 列間ギャップ `space-lg`、列ヘッダーとカード群の間 `space-md`。列内カード間は `space-md`。
- **スクロール**: ボード領域は `height: calc(100vh - header - filter)` を基準にし、余白調整で不要な余白を作らない。

### 5.3 Reports Page
- **構成**: ページヘッダー、入力フォーム、プレビューカード。
- **フォームグリッド**: Desktop では `form-grid` を 2 カラム (`minmax(280px, 1fr)`)、Tablet 以下では 1 カラム。フィールド間 `space-lg`。
- **プレビュー**: フォームの直下に `space-2xl` を確保、フォームとプレビューの背景トーンを変えボーダーで区切る。

### 5.4 Settings / Administration Page
- **構成**: 左サイドバー（ナビゲーション） + 右コンテンツ。
- **サイドバー**: 幅 280px、上下 `space-xl`。項目間 `space-md`。
- **コンテンツ**: セクション間 `space-xl`、カード内 `space-lg`。アクションボタンはセクション末尾に右揃え。

### 5.5 Modal / Drawer
- 最大幅 480px、内部余白 `space-lg`。タイトルと本文の間に `space-md`、本文とアクションの間に `space-lg`。
- ドロワーは幅 400px、ページ外周とのギャップを持たず、内部余白で調整する。

## 6. Component-level Layout Rules
- **Page Header**: Eyebrow ↔ Title は `space-xs`、Title ↔ Description は `space-sm`、アクション群とは `space-md`。
- **Page Section Wrapper**: `.app-page-layout__section` は CSS Grid (`display: grid`) を採用し、セクション内のブロック間隔をトークン化されたギャップで制御する。個別に余白を積み重ねず、グリッドのギャップ設定を優先すること。
- **Card**: 上下左右 `space-lg`、ヘッダー ↔ ボディ `space-md`、ボディ内の段落 `space-md`。
- **List Item**: 最低高さ 56px、上下 `space-md`、アイコン ↔ テキスト `space-sm`。
- **Table**: 行高 48px、セル左右 `space-md`、行間 `space-xs` のボーダー。
- **Form Field**: ラベル ↔ フィールド `space-xs`、フィールド同士 `space-lg`。補助テキストはラベルの下に `space-xxs` で配置。

## 7. Responsive Behavior
- モバイルではページヘッダーの説明文を折りたたみ、アクション群はボタン + オーバーフローメニューにまとめる。
- カードグリッドはモバイルで 1 カラム、Tablet で 2 カラム、Desktop で 3 カラム以上。
- サイドバーはモバイルではドロワー化し、メインコンテンツの余白は左右 24px を維持。

## 8. Accessibility & Readability
- 余白による意味的グルーピングを徹底し、関連要素間に `space-md` 未満の間隔を残さない。
- 連続するボタン群は `space-sm` を確保し、キーボードフォーカス時に十分なアウトラインスペースを持たせる。
- コンテンツブロック間の余白を一定にすることで、スクリーンリーダー用ランドマークの配置と視覚的区切りを一致させる。

## 9. Validation Checklist
1. ページ外周余白はブレークポイントごとの指定値内に収まっているか。
2. セクション間のスペースが `space-xl` 以上になっているか。
3. フィルタバー・フォームなど操作エリアの縦横整列が保たれているか。
4. コンポーネント間の余白が 8px 以下になっていないか。
5. モバイル・Tablet でのスタック順序と余白がデスクトップ版と論理的に一致しているか。
6. 画面密度が高い領域（表やカードグリッド）でも `space-md` の呼吸が保たれているか。
7. UI デザインシステムのトークン (`--space-*`, `--surface-layer-*`) と整合しているか。

## 10. Governance
- レイアウトに関する仕様変更はデザインシステムガバナンス会議で承認を得る。
- 実装前に Figma のレイアウトグリッドを最新トークンに更新し、デザイナー/エンジニアの双方でレビューする。
- コード実装時は `docs/ui-design-system.md` と本ドキュメントを参照し、逸脱が必要な場合は理由と影響範囲を記録する。
