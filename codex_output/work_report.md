**背景**
- 定期ドキュメント最新化依頼に基づき、最小差分で精度と可読性を改善。
- 対象は `README.md` と `docs/README.md` のみ（リンク破断リスクを抑制）。
- 30分枠・不要な作業の抑制・英語維持（明示指定なしのため）を前提。

**変更概要**
- `README.md`
  - 見出しの表記を整備: “Manual setup (macOS/Linux)” に統一。
  - 環境変数テーブルのレンダリング崩れを修正（挿入文言を表下へ移動）。
- `docs/README.md`
  - 文字化け/残存アーティファクト（例: 不要な記号）を除去し、箇条書き表記を統一（“ — ”）。
  - “Recipes index” を追記し `docs/recipes/README.md` へ案内。
- 構造変更（改名・移動・分割/統合）は未実施。既存リンクの安定性を優先。

**影響**
- 表記統一とテーブル修復により可読性とレンダリング品質が向上。
- 既存の相対リンク/導線は維持。大規模なリンク破断リスクは低い。
- 言語は英語のまま維持（多言語化は未対応）。必要なら後続タスク化。

**検証**
- 文字化けの残存確認:
  - `rg -n " E" docs/README.md`
- 主要リンクの存在確認:
  - `test -f docs/governance/development-governance-handbook.md && test -f docs/guidelines/angular-coding-guidelines.md && test -f docs/ui-design-system.md && test -f docs/ui-layout-requirements.md && test -f docs/recipes/README.md && echo links_ok || echo links_missing`
- 見出し整備の反映確認:
  - `rg -n "Manual setup \\(macOS/Linux\\)" README.md`

**レビュー観点**
- 英語維持で問題ないか（日本語併記の要否）。
- “Recipes index” 追加の適否と導線配置の妥当性。
- 触れていない他ドキュメントにも同様の表記揺れ/レンダリング崩れがないか、必要範囲での追随可否。
- 見出しアンカー/内部リンクに影響がないかの軽い目視確認（GitHub表示での実レンダリング確認）。