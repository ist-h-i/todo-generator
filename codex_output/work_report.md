**背景**
- 目的: ソース内の関数・変数の説明を「レシピ」として整備し、最小差分で早期完了。
- 方針: 既存の per-file 形式のレシピ規約に合わせ、ファイル単位で `.recipe.md` を生成。大規模改変や新規様式（per-folder）の導入は回避。
- スコープ: `backend/app/**` と `frontend/src/**` の本番コード（テスト・生成物は除外）。

**変更概要**
- 生成スクリプト追加: `scripts/generate_file_recipes.py`
  - `backend/app/**/*.py` と `frontend/src/**/*.ts` を走査（`*.spec.ts` やテスト除外）。
  - `docs/recipes/<relative_path with __>.recipe.md` を新規作成（既存は上書きしない、冪等）。
  - 抽出: Pythonは`ast`でトップレベル関数/変数、TSは`export function`と`export const/let/var`を簡易正規表現で抽出。
- ドキュメント更新: `docs/recipes/README.md` に生成手順（任意）を追記。
- 代表例のレシピを種まき:
  - `docs/recipes/backend__app__main.py.recipe.md`
  - `docs/recipes/backend__app__routers__status_reports.py.recipe.md`
  - `docs/recipes/backend__app__services__status_reports.py.recipe.md`
  - `docs/recipes/frontend__src__app__app.ts.recipe.md`
  - `docs/recipes/frontend__src__app__core__api__status-reports-gateway.ts.recipe.md`

**影響**
- 実行時の挙動・ビルドへ影響なし（ドキュメントと補助スクリプトのみ）。
- レシピ整備の初期コストを低減し、段階的な充実が容易に。
- 既存規約との整合性維持。複雑なエクスポート（再エクスポートや改行を跨ぐ宣言）は抽出漏れの可能性あり。

**検証**
- 生成: `python scripts/generate_file_recipes.py`
- 部分生成: パス指定で限定実行可（例: `python scripts/generate_file_recipes.py backend/app/routers`）
- 確認ポイント:
  - 代表ディレクトリのレシピ内容がエクスポート実体を列挙できているか。
  - 冪等性: 同コマンド再実行で差分が発生しないこと。
  - スコープ: テストや非対象ファイルが含まれていないこと。

**レビュー観点**
- 形式の確認: per-file レシピで合意か（per-folder 概観が別途必要か）。
- カバレッジ: まずはどのディレクトリを優先するか（backend / frontend / 双方）。
- 深さ: 変数は公開/エクスポートのみで十分か、トップレベルに限定で妥当か。
- 運用: 生成スクリプトをいつ誰が走らせるか（都度/定期/CI連携の要否）。
- 次の一手: レポ全体へ一括適用するか、対象範囲を指定して段階導入するか。