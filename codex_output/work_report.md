**背景**
- 目的: 新規参画者が迷わず目的のコード/ドキュメントへ到達できるよう、リポジトリ全体の索引を追加。
- 方針: 既存構造は変更せず、最小差分で横断的な導線を整備（1ファイル追加 + 2つの小さなリンク追記）。
- 前提: 英語ドキュメント維持、リンク安定性重視、30分枠・小さな変更で完結。

**変更概要**
- リポジトリ索引を新規追加: `docs/INDEX.md`
  - 主要ディレクトリの役割と入口を一覧化（例: フロント/バックエンド、ドキュメント、スクリプト、CI/設定）。
  - 重要ドキュメントへのショートカットを集約:
    - `docs/governance/development-governance-handbook.md`
    - `docs/guidelines/angular-coding-guidelines.md`
    - `docs/ui-design-system.md`
    - `docs/ui-layout-requirements.md`
- クロスリンクを追加（小変更のみ）:
  - ルート `README.md` に索引への導線を1行追記（例: “Repository Index & Map” → `docs/INDEX.md`）。
  - `docs/README.md` に相互参照リンクを1行追記（例: “Repository Index & Map” → `docs/INDEX.md`）。
- 構造変更（改名/移動/分割/統合）は未実施。既存リンク/アンカーを温存。

**影響**
- 新規参画者の初期探索コストを削減（2–3クリックで主要コード/ガイドへ到達）。
- 変更範囲は限定的（新規1ファイル + 追記2行程度）。既存の相対リンクに影響なし。
- コード/ビルド/依存関係には非影響。リスクは低く、ロールバック容易。

**検証**
- 追加物の存在確認:
  - `test -f docs/INDEX.md`
- クロスリンクの存在確認:
  - `rg -n "\[Repository Index & Map\]\(docs/INDEX.md\)" README.md`
  - `rg -n "\[Repository Index & Map\]\(INDEX.md\)" docs/README.md`
- キードキュメントの存在確認:
  - `test -f docs/governance/development-governance-handbook.md`
  - `test -f docs/guidelines/angular-coding-guidelines.md`
  - `test -f docs/ui-design-system.md`
  - `test -f docs/ui-layout-requirements.md`
- 目視レンダリング確認（GitHub 等）:
  - 箇条書き/相対リンクが正しく機能し、崩れがないこと。

**レビュー観点**
- 索引の粒度は十分か（トップレベル中心で良いか、主要機能単位をもう1段追加するか）。
- 索引ファイル名の妥当性（`docs/INDEX.md` で問題ないか、`docs/00-index.md` を好むか）。
- 英語のみでよいか（見出しのみ日英併記の要否）。
- CI/インフラ（`.github/workflows/`、Docker 等）導線を含める範囲の妥当性。
- 今後の拡張方針（新ディレクトリ追加時に `docs/INDEX.md` に1行追記する運用で合意できるか）。
