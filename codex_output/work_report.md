**背景**
- 目的: 新規参画者がコード/ドキュメントの所在と入口を素早く把握できるよう、横断的な索引を整備。
- 方針: 最小差分・低リスク（既存構造は維持、英語維持、30分枠）。
- 対象: 新規ファイル1点（docs/INDEX.md）＋README類への小さなリンク追記のみ。

**変更概要**
- リポジトリ索引を新規追加: `docs/INDEX.md`
  - トップレベル領域（コード/ドキュメント/スクリプト/CI 等）の役割と入口を簡潔に集約。
  - Quick Links（ガバナンス、Angularガイド、UI設計/レイアウト）へのショートカットを明示。
  - Search Tips → Routes のパターンを実運用に寄せて補正: `export const .*Routes|appRoutes|Routes\s*=\s*\[`
- クロスリンクの追記（小変更のみ）
  - ルート `README.md` に “Repository Index & Map” → `docs/INDEX.md`
  - `docs/README.md` に “Repository Index & Map” → `docs/INDEX.md`（相対: `INDEX.md`）
- 構造変更（移動/改名/分割/統合）は未実施。

**影響**
- 主要領域/重要ドキュメントに2–3クリックで到達可能になり、初期探索コストを削減。
- 既存リンク/アンカーへ影響なし。ビルド/依存関係/実行時挙動への影響なし。
- ロールバック容易（1ファイル削除＋2行程度の削除で戻せる）。

**検証**
- 追加物の存在確認
  - `test -f docs/INDEX.md`
- クロスリンクの存在確認
  - `rg -n "\[Repository Index & Map\]\(docs/INDEX.md\)" README.md`
  - `rg -n "\[Repository Index & Map\]\(INDEX.md\)" docs/README.md`
- Quick Links の存在確認
  - `test -f docs/governance/development-governance-handbook.md`
  - `test -f docs/guidelines/angular-coding-guidelines.md`
  - `test -f docs/ui-design-system.md`
  - `test -f docs/ui-layout-requirements.md`

**レビュー観点**
- 索引の粒度は妥当か（トップレベル中心で十分か、主要機能単位を一段追加するか）。
- 索引ファイル名の妥当性（`docs/INDEX.md` で良いか、並び優先なら `docs/00-index.md` か）。
- CI/インフラ（`.github/workflows/`、Docker 等）への導線を索引に含めるか。
- 英語のみで良いか（見出しのJP/EN併記要否）。
- 運用: 新ディレクトリ追加時は `docs/INDEX.md` に1行追記するルールで合意できるか。