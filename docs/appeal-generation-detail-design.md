# Appeal Narrative Generation 詳細設計

## 1. 目的と範囲
本書は「Appeal Narrative Generation Requirements v0.1」で定義された要件を実装に落とし込むための詳細設計を示す。対象は FastAPI ベースのバックエンド、Angular SPA フロントエンド、OpenAI Responses API を利用した生成基盤、および関連するデータ永続化とテレメトリである。MVP リリースで提供するサブジェクト選択、フロー構築、フォーマット別生成、編集・エクスポート、失敗時フォールバックを対象とし、将来拡張 (フロープリセット保存等) は考慮しつつ実装外とする。

## 2. 全体アーキテクチャ
```
sequenceDiagram
    participant U as User (SPA)
    participant FE as Frontend (Angular)
    participant BE as Backend (FastAPI)
    participant AI as OpenAI Responses API
    participant DB as DB (appeal_generations)
    participant TM as Telemetry Sink

    U->>FE: サブジェクト/フロー/フォーマット設定
    FE->>BE: GET /appeals/config
    BE->>DB: ラベル・推奨フロー取得
    DB-->>BE: 設定返却
    BE-->>FE: Config JSON
    U->>FE: 生成実行
    FE->>BE: POST /appeals/generate
    BE->>AI: Prompt (subject + achievements + flow)
    AI-->>BE: Generated Narratives per format
    BE->>DB: 永続化 (appeal_generations)
    BE->>TM: Telemetry events
    BE-->>FE: Generation result
    FE->>U: プレビュー/編集/エクスポート
```

## 3. フロントエンド詳細
### 3.1 モジュール構成
- 新規モジュール `AppealModule` を `frontend/src/app/features/appeal/` に追加。
- ルーティング: `/appeals/generate` (ガードは既存 AuthGuard を適用)。
- コンポーネント:
  - `AppealWizardComponent`: 3 ステップ (Subject -> Flow -> Format & Preview) の wizard コンテナ。
  - `AppealSubjectStepComponent`: ラベル一覧取得・検索、カスタムテキスト入力 (最大 120 文字) を担当。
  - `AppealFlowStepComponent`: ドラッグ&ドロップ対応のステップ並び替え (Angular CDK DragDrop)・バリデーションを実装。
  - `AppealFormatPreviewComponent`: フォーマット選択とマルチプレビュータブを表示。各タブ内に `AppealFormatEditorComponent` を配置。
  - `AppealGenerationToolbarComponent`: 生成ボタン、キャンセル、再生成、コピー/ダウンロードアクションを集約。

### 3.2 状態管理
- `AppealWizardStore` (Component Store) を導入し、以下の状態を保持。
  - `subject`: { type: 'label' | 'custom', value: string }
  - `flowSteps`: StepID[]
  - `formats`: FormatID[]
  - `generation`: { status: 'idle'|'loading'|'success'|'error', result?: GeneratedContent, error?: string }
  - `achievements`: カード達成要約配列 (ラベル選択時にバックエンドから取得)
- 生成結果はフォーマット毎にマップ `{ formatId: { content: string, edited: boolean } }` として保持。編集は frontend 側で差分追跡。
- コンポーネント間通信は store の selector + updater を利用して疎結合化。

### 3.3 UX / UI 挙動
- ステップ遷移時にバリデーションを実施。未入力の場合はエラー表示。
- 生成中はローディングオーバーレイとキャンセルボタン (HTTP AbortController) を表示。
- エディタは `ngx-monaco-editor` を利用し、フォーマットに応じてモード切替:
  - 平文/箇条書き: markdown モード
  - 表形式: CSV モード (カンマ区切り)
  - Markdown: markdown モード + シンタックスハイライト
- コピーは `navigator.clipboard.writeText`、ダウンロードは Blob URL 生成で対応。
- エラー発生時は `AppealErrorBannerComponent` で理由・再試行ボタン・テンプレートプレースホルダ表示。

### 3.4 API 通信
- `AppealService` を新設 (`frontend/src/app/features/appeal/data/appeal.service.ts`)。
  - `getConfig()`: `/appeals/config` を呼び、ラベルグループ・推奨フロー・フォーマット定義を取得。
  - `generate(request: AppealGenerationRequest, abort?: AbortSignal)`:
    - POST `/appeals/generate`
    - レスポンス: `AppealGenerationResponse` (フォーマットごとの本文、メタ情報)
  - `export(format, content)` はフロント内で完結するためサービス外。

### 3.5 テレメトリ
- `analyticsService.track('appeal.flow_configured', payload)` を flow 確定時に送信。
- 生成成功時に `appeal.generate`、エクスポート時に `appeal.export` を送信。
- payload: workspaceId, subjectType, flowLength, formats, editedFlag 等。

## 4. バックエンド詳細
### 4.1 API エンドポイント
- ルーター: `backend/app/routers/appeals.py` を新設し、`/appeals` プレフィックスで公開。
- 依存: 認証 (既存 `get_current_user`)、DB セッション、ChatGPTClient。

#### GET /appeals/config
- 入力: なし。
- 処理:
  1. ワークスペースコンテキストから利用可能なラベルグループと達成要約を取得 (`LabelRepository.get_groups_with_achievements(workspace_id)`)。
  2. 推奨フローを返却 (固定: 課題→対策→実績→所感)。
  3. 利用可能フォーマットのメタデータ (ID, 表示名, 説明, 対応エディタモード) を返却。
- 出力: `AppealConfigResponse`。

#### POST /appeals/generate
- 入力: `AppealGenerationRequest`:
  - `subject`: { `type`: 'label' | 'custom', `value`: str }
  - `flow`: str[] (1–5)
  - `formats`: str[] (1–4)
  - `achievements`: 任意。ラベル選択時はバックエンドで再取得して信頼性確保。
- バリデーション:
  - flow 長さ 1–5、重複禁止。
  - 因果順違反 (課題なしで実績のみ等) は Warning としてレスポンスに `warnings` を付与。
  - Custom subject の XSS サニタイズ (Bleach) を適用。
- 処理フロー:
  1. 選択ラベルに紐づくカード達成要約を `CardAchievementRepository.list_by_label(workspace_id, label_id)` で取得。
  2. プロンプト生成 (`AppealPromptBuilder.build(...)`)。入力要素: subject summary、flow step descriptions、achievements (時系列ソート)、フォーマット指定。
  3. `ChatGPTClient.generate_appeal(prompt, response_schema)` を呼び出し、フォーマットごとに構造化レスポンスを受信。
  4. 生成結果を `AppealGenerationResult` モデルにマッピング。フォーマット毎に causal connector の存在をチェックし、不足時は後処理で文頭に挿入。
  5. `AppealGenerationRepository.create(...)` で `appeal_generations` テーブルに保存。
  6. テレメトリイベント `appeal.generate` を発火。
- 出力: `AppealGenerationResponse`
  - `formats`: { formatId: { `content`: str, `tokensUsed`: int } }
  - `subjectEcho`: str
  - `flow`: str[]
  - `warnings`: string[]
  - `generationId`: UUID

### 4.2 モデル・スキーマ
- Pydantic Schemas (`backend/app/schemas/appeals.py`):
  - `AppealSubject`, `AppealFlowStep`, `AppealFormat`, `AppealConfigResponse`, `AppealGenerationRequest`, `AppealGenerationResponse`。
- SQLAlchemy Model (`backend/app/models.py` 末尾付近に追加):
  - `AppealGeneration`: columns `id (UUID PK)`, `workspace_id (FK)`, `subject_type`, `subject_value`, `flow (JSON)`, `formats (JSON)`, `content_json (JSONB)`, `token_usage (JSON)`, `created_by`, `created_at`。
- Repository (`backend/app/repositories/appeals.py`):
  - `create`, `list_recent(workspace_id, limit=20)` など。MVP は `create` のみ必須。

### 4.3 サービス層
- `AppealService` (`backend/app/services/appeals.py`):
  - `generate(...)` が上記処理をカプセル化。
  - ChatGPT 例外時は `AppealFallbackBuilder.build(flow)` でテンプレート生成し、`generation_status='fallback'` をレスポンスに含める。
  - パフォーマンス監視のため計測デコレータ (既存 metrics ユーティリティ) を利用。

### 4.4 プロンプト設計
- Prompt テンプレート (YAML or f-string) を `backend/app/prompts/appeals.jinja` として管理。
- 入力: `workspace_profile`, `subject_summary`, `flow_steps` (label +説明), `achievements` (時系列), `required_connectors` list。
- 出力スキーマ: JSON schema
  ```json
  {
    "type": "object",
    "properties": {
      "formats": {
        "type": "object",
        "patternProperties": {
          ".*": {
            "type": "object",
            "properties": {
              "content": {"type": "string"},
              "tokens_used": {"type": "integer"}
            },
            "required": ["content"]
          }
        }
      }
    },
    "required": ["formats"]
  }
  ```
- トーン指示: プロフェッショナルかつ因果関係を明示。「そのため」「結果として」などの接続詞を強調。

### 4.5 エラーハンドリング
- ChatGPTClient からの `HTTPException` やタイムアウトは `AppealGenerationError` に変換。
- レスポンス例:
  ```json
  {
    "status": "error",
    "message": "生成に失敗しました。再試行するかテンプレートを利用してください。",
    "fallback": {"format": "markdown", "content": "# {step} ..."}
  }
  ```
- ログ: `logger.warning` で workspace_id, subject_type, latency, error_code を記録。
- 再試行: 最大 1 回。2 回目も失敗した場合はフォールバック。

### 4.6 セキュリティ / プライバシー
- サブジェクト・実績データから個人名などの機微情報をマスク (既存 `mask_sensitive_text` ユーティリティを利用)。
- OpenAI 呼び出し前に data residency ポリシー確認: リクエスト payload に workspace リージョンを添付。
- `appeal_generations` の保存データは 30 日で自動削除するスケジュールタスクを Celery/cron に設定 (既存バッチにジョブ追加)。

## 5. データ取得・キャッシュ戦略
- ラベルと実績要約はキャッシュ (`functools.lru_cache` + invalidation on card update event)。
- 生成履歴は直近 5 件を `GET /appeals/history` (将来拡張) で活用予定。MVP では未公開だが repository は再利用できるよう設計。

## 6. パフォーマンス考慮
- OpenAI 呼び出しは非同期 (`asyncio`) で実行し、8 秒 SLA をモニタリング。
- 生成プロンプトサイズ上限を 4k tokens に制限。実績が多い場合は最新 10 件を要約して使用。
- UI は並列フォーマット描画ではなく遅延レンダリング (タブアクティブ時に初回レンダリング)。

## 7. テスト計画
- フロントエンド:
  - Component 単体テスト: wizard ステップのバリデーション、flow ドラッグ&ドロップ順序の保持。
  - Service 統合テスト: `AppealService.generate` が API レスポンスを正しく変換するか。
- バックエンド:
  - API テスト: happy path、flow バリデーション失敗、ChatGPT タイムアウト時のフォールバック。
  - Prompt builder テスト: flow/achievements の整形、接続詞挿入の確認。
  - Repository テスト: `create` が JSON カラムを保存できるか。
- テレメトリ: track 呼び出しの payload 生成をユニットテスト。

## 8. ログ & モニタリング
- 生成時間、トークン使用量、失敗率を Prometheus メトリクスに追加。
- 失敗率 >5% で PagerDuty アラート。平均レスポンス >12 秒で警告。
- 監査ログ: フロントの編集履歴はローカル保持のみ (サーバ保存は要件外) だが、エクスポート時に editedFlag を送信。

## 9. リスクと対策
| リスク | 対策 |
| --- | --- |
| 生成結果の品質不足 | 接続詞チェック、フォーマット別テンプレート微調整、ユーザーからのフィードバック収集 UI を用意 |
| フロー設定の複雑性 | 推奨フローのプリセット表示、ステップ説明ツールチップ、ガイダンスバナー |
| OpenAI 障害時のダウンタイム | フォールバックテンプレート、キャッシュ済み最新生成の再表示、リトライロジック |
| データリーク | マスキングユーティリティ、最小限の achievement 情報を送信 |

## 10. 今後の拡張余地
- フローテンプレート保存・共有機能
- 生成履歴の再利用、差分比較
- マルチサブジェクト対応 (複数ラベルを束ねた生成)
- 多言語対応 (英語/中国語)

