# Appeal Narrative Generation Requirements

## Document Control
| Field | Value |
| --- | --- |
| Version | 1.0 |
| Author | Product Design Team |
| Last Updated | 2024-06-30 |
| Status | Approved |

## 1. Background & Objectives
カードの活動履歴から成果を説明するアピール文の作成は、担当者ごとに構成や語調がばらつき、レビューや社内申請のたびに時間が掛かっていました。Appeal Narrative Generation 機能は、カードに紐づく実績と選択した構成要素をもとに AI が叙述を生成し、成果報告の品質を一定に保つことを目的とします。【F:backend/app/routers/appeals.py†L1-L27】【F:backend/app/services/appeals.py†L1-L200】

### Objectives
1. ラベルまたは自由入力からアピール対象を選択し、推奨フローを土台に 1～5 ステップの因果構成を調整できること。【F:backend/app/services/appeals.py†L32-L115】
2. Markdown・箇条書き・CSV テーブルの 3 フォーマットを同時に生成し、各フォーマットが編集/エクスポートしやすい構造になっていること。【F:backend/app/services/appeals.py†L32-L152】
3. OpenAI 連携に失敗した場合でもフォールバック文章を返し、生成履歴に保存することでレポート作成を継続できること。【F:backend/app/services/appeals.py†L106-L162】【F:backend/app/repositories/appeals.py†L17-L50】

## 2. Success Metrics
| Metric | Target | Measurement |
| --- | --- | --- |
| 生成採用率 | 60% の生成結果が編集後に共有/提出される | `appeal.generate`、`appeal.export` イベント解析 |
| 生成所要時間 | p95 8 秒以内 | API レイテンシーログ |
| 再試行率 | 10% 未満 | フォールバック発生とリトライ回数 |

## 3. Scope
### In Scope
- `/appeals/config` によるラベル一覧・推奨フロー・対応フォーマットの取得。【F:backend/app/services/appeals.py†L70-L115】
- `/appeals/generate` でのアピール生成、XSS マスキング、ChatGPT 呼び出し、フォールバック構築、履歴保存。【F:backend/app/services/appeals.py†L78-L155】
- 生成結果とトークン使用量、警告メッセージを JSON として返却。【F:backend/app/services/appeals.py†L145-L163】
- `appeal_generations` テーブルでの履歴保管と最新 20 件の取得。【F:backend/app/models.py†L708-L723】【F:backend/app/repositories/appeals.py†L17-L50】

### Out of Scope
- UI でのテンプレート編集機能（別ロードマップ扱い）。
- 生成結果の PDF 変換やワークスペース共有設定。
- 多言語対応と複数ラベル同時選択のサポート。

## 4. Personas
| Persona | Goals | Key Needs |
| --- | --- | --- |
| Continuous Improvement Lead | エグゼクティブ向け報告書の品質を揃えたい | 推奨フローとフォーマットの自動構成 |
| Team Facilitator | レトロスペクティブで成果を共有したい | 達成ハイライトを含む要約生成 |
| Customer Success Manager | 顧客向けアピール資料を短時間で準備したい | Markdown や CSV で再利用可能な文書 |

## 5. User Stories & Acceptance Criteria
1. **Config 取得** – ユーザーは推奨フローと選択可能フォーマットを確認できる。`GET /appeals/config` はユーザー所有のラベルと推奨フロー `課題→対策→実績→所感` を返し、フォーマットは `markdown` `bullet_list` `table` の 3 種類である。【F:backend/app/services/appeals.py†L70-L115】
2. **生成リクエスト** – ユーザーは subject/type/flow/formats を指定して生成を実行できる。flow と formats は重複不可で 1～5 ステップに制限され、`label` 指定時は該当ラベルの所有権が検証される。【F:backend/app/schemas.py†L1015-L1059】【F:backend/app/services/appeals.py†L84-L103】
3. **成果要約の統合** – ラベル経由で紐づく達成実績を取得し、サニタイズした上でプロンプトやフォールバックに利用する。【F:backend/app/services/appeals.py†L101-L135】【F:backend/app/services/appeals.py†L169-L199】
4. **フォールバック** – ChatGPT 呼び出しに失敗した場合でも、フォーマット別テンプレートで内容を補完し、`generation_status='fallback'` と警告を返す。【F:backend/app/services/appeals.py†L106-L162】【F:backend/app/services/appeal_prompts.py†L96-L173】
5. **履歴保存** – 生成が完了すると subject/flow/formats/警告/トークン使用量を保存し、レスポンスに生成 ID を含める。【F:backend/app/services/appeals.py†L145-L163】【F:backend/app/repositories/appeals.py†L17-L41】

## 6. Functional Requirements
1. **Subject Handling** – `label` タイプは所有者チェックとラベル名取得、`custom` タイプは HTML エスケープと 120 文字制限を行う。【F:backend/app/services/appeals.py†L84-L175】
2. **Achievements Retrieval** – ラベル指定時はカード実績を時系列で収集し、タイトル・サマリーを個人情報マスキング後に利用する。【F:backend/app/services/appeals.py†L101-L199】
3. **Prompt Composition** – Jinja テンプレートを使い、フロー説明・フォーマット定義・因果接続詞をプロンプトに含める。テンプレート読み込みに失敗した場合はフォールバックのみ実行する。【F:backend/app/services/appeal_prompts.py†L21-L118】【F:backend/app/services/appeals.py†L54-L144】
4. **Response Validation** – ChatGPT 応答を JSON スキーマで検証し、各フォーマットの本文とトークン使用量をマージする。【F:backend/app/services/appeal_prompts.py†L120-L156】【F:backend/app/services/appeals.py†L117-L138】
5. **Warnings** – 因果推奨を外れたフロー選択時は警告配列を付与し、UI に表示可能なテキストを返却する。【F:backend/app/services/appeals.py†L272-L279】

## 7. Non-Functional Requirements
- **Reliability** – ChatGPT 未設定またはタイムアウト時もフォールバックを返却し、HTTP 503 などのエラーは避ける。【F:backend/app/services/appeals.py†L106-L162】
- **Security** – 件名・実績内のメールや電話番号をマスキングし、HTML をエスケープする。【F:backend/app/services/appeals.py†L169-L199】
- **Observability** – 生成時間とフォールバック率をログ計測し、8 秒 SLA 超過時にアラート設定できるようメトリクスを出力する。【F:backend/app/services/appeals.py†L117-L145】
- **Extensibility** – フォーマット定義はクラス変数で管理し、将来の追加に備える。【F:backend/app/services/appeals.py†L32-L75】

## 8. Risks & Mitigations
| Risk | Mitigation |
| --- | --- |
| フォールバック文章が汎用的すぎる | 達成実績やフローをテンプレートに含め、接続詞で因果関係を補強する。【F:backend/app/services/appeal_prompts.py†L96-L173】 |
| ラベル共有に伴うデータ漏えい | 所有者チェックとマスキング処理で他ワークスペースの情報が混入しないようにする。【F:backend/app/services/appeals.py†L84-L199】 |
| ChatGPT 設定ミス | プロンプトビルダー初期化に失敗した場合の警告ログとフォールバック動作で影響を局所化する。【F:backend/app/services/appeals.py†L54-L143】 |

## 9. Open Questions
- 生成履歴の UI 提供タイミングと保持件数の上限はどこまで必要か。
- ワークスペース単位で推奨フローをカスタマイズする要望をどのように管理するか。
