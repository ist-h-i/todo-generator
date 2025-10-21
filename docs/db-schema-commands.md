# Database Table Creation Commands

このドキュメントでは、`backend/app/models.py` で定義されている全テーブルの `CREATE TABLE` コマンドを一覧化しています。利用するデータベースに応じて型の互換性を確認し、必要に応じてデフォルト値や JSON 型の表現を調整してください。タイムスタンプ列は `CURRENT_TIMESTAMP` を既定値としており、`updated_at` はトリガーまたはアプリケーション層で更新する想定です。

## 自動適用バッチ

スキーマを自動で作成・更新する場合は `scripts/bootstrap_database.py` を利用します。初回のデプロイや新しい環境では `--provision` オプションを付けて未作成テーブルのみを作成し、その後はマイグレーションだけを実行することで既存データを保持したまま最新スキーマへ追従できます。SQLAlchemy のモデル定義を元に欠損テーブルを生成し、既存データベースには起動時マイグレーションを適用するため、手動で下記 SQL を流す必要はありません。

```bash
# 初回のみ: スキーマを新規作成
python scripts/bootstrap_database.py --provision --database-url postgresql://username:password@host:5432/database

# 2 回目以降: デプロイ時にマイグレーションのみ実行
python scripts/bootstrap_database.py --database-url postgresql://username:password@host:5432/database
```

- `--database-url` を省略すると環境変数 `DATABASE_URL` の値を使用します。
- `--provision` を指定すると未作成テーブルのみを追加し、既存データは変更しません。既に全テーブルが存在する場合はテーブル作成をスキップします。未作成テーブルが残っている状態で `--provision` を付けずに実行するとエラー終了します。
- `--skip-migrations` を指定するとテーブル作成のみを行い、既存スキーマに対するマイグレーションはスキップします。

> **補足**: 外部キーの `ON DELETE` 動作はアプリケーションの期待値を保つため必ず有効化してください。SQLite を使用する場合は `PRAGMA foreign_keys = ON;` を忘れずに設定します。

## users

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    nickname VARCHAR(64),
    experience_years INTEGER,
    roles JSON DEFAULT '[]',
    bio TEXT,
    avatar_image BYTEA,
    avatar_mime_type VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_users_email ON users(email);
```

## session_tokens

```sql
CREATE TABLE session_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## statuses

```sql
CREATE TABLE statuses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    "order" INTEGER,
    color TEXT,
    wip_limit INTEGER,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (owner_id, name)
);
```

## error_categories

```sql
CREATE TABLE error_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    severity_level TEXT,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (owner_id, name)
);
```

## daily_card_quotas

```sql
CREATE TABLE daily_card_quotas (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id TEXT NOT NULL,
    quota_date DATE NOT NULL,
    created_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (owner_id, quota_date)
);
```

## workspace_templates

```sql
CREATE TABLE workspace_templates (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    default_status_id TEXT,
    default_label_ids JSON DEFAULT '[]',
    confidence_threshold REAL DEFAULT 60.0,
    field_visibility JSON DEFAULT '{"show_story_points": true, "show_due_date": false, "show_assignee": true, "show_confidence": true}',
    is_system_default BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (default_status_id) REFERENCES statuses(id) ON DELETE SET NULL
);
```

## improvement_initiatives

```sql
CREATE TABLE improvement_initiatives (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner TEXT,
    start_date TIMESTAMP WITH TIME ZONE,
    target_metrics JSON DEFAULT '{}',
    status TEXT,
    health TEXT,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## cards

```sql
CREATE TABLE cards (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    description TEXT,
    status_id TEXT,
    priority TEXT,
    story_points INTEGER,
    estimate_hours REAL,
    assignees JSON DEFAULT '[]',
    start_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    dependencies JSON DEFAULT '[]',
    ai_confidence REAL,
    ai_notes TEXT,
    ai_failure_reason TEXT,
    custom_fields JSON DEFAULT '{}',
    error_category_id TEXT,
    initiative_id TEXT,
    ai_similarity_vector_id TEXT,
    analytics_notes TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (status_id) REFERENCES statuses(id),
    FOREIGN KEY (error_category_id) REFERENCES error_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (initiative_id) REFERENCES improvement_initiatives(id) ON DELETE SET NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## labels

```sql
CREATE TABLE labels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    description TEXT,
    is_system BOOLEAN DEFAULT TRUE,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (owner_id, name)
);
```

## card_labels

```sql
CREATE TABLE card_labels (
    card_id TEXT NOT NULL,
    label_id TEXT NOT NULL,
    PRIMARY KEY (card_id, label_id),
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);
```

## analytics_snapshots

```sql
CREATE TABLE analytics_snapshots (
    id TEXT PRIMARY KEY,
    title TEXT,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    metrics JSON DEFAULT '{}',
    generated_by TEXT,
    workspace_id TEXT,
    narrative TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## root_cause_analyses

```sql
CREATE TABLE root_cause_analyses (
    id TEXT PRIMARY KEY,
    snapshot_id TEXT,
    target_type TEXT NOT NULL DEFAULT 'snapshot',
    target_id TEXT,
    created_by TEXT,
    version INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending',
    model_version TEXT,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (snapshot_id) REFERENCES analytics_snapshots(id) ON DELETE SET NULL
);
```

## root_cause_nodes

```sql
CREATE TABLE root_cause_nodes (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL,
    depth INTEGER DEFAULT 0,
    statement TEXT NOT NULL,
    confidence REAL,
    evidence_refs JSON DEFAULT '[]',
    recommended_metrics JSON DEFAULT '[]',
    parent_id TEXT,
    state TEXT DEFAULT 'proposed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (analysis_id) REFERENCES root_cause_analyses(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES root_cause_nodes(id) ON DELETE SET NULL
);
```

## subtasks

```sql
CREATE TABLE subtasks (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT,
    priority TEXT,
    assignee TEXT,
    start_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    estimate_hours REAL,
    story_points INTEGER,
    checklist JSON DEFAULT '[]',
    ai_similarity_vector_id TEXT,
    root_cause_node_id TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    FOREIGN KEY (root_cause_node_id) REFERENCES root_cause_nodes(id) ON DELETE SET NULL
);
```

## user_preferences

```sql
CREATE TABLE user_preferences (
    user_id TEXT PRIMARY KEY,
    board_grouping TEXT,
    board_layout JSON DEFAULT '{}',
    visible_fields JSON DEFAULT '[]',
    notification_settings JSON DEFAULT '{}',
    preferred_language TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## comments

```sql
CREATE TABLE comments (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    subtask_id TEXT,
    author_id TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    FOREIGN KEY (subtask_id) REFERENCES subtasks(id) ON DELETE CASCADE
);
```

## activity_logs

```sql
CREATE TABLE activity_logs (
    id TEXT PRIMARY KEY,
    card_id TEXT,
    actor_id TEXT,
    action TEXT NOT NULL,
    details JSON DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    UNIQUE (id)
);
```

## initiative_progress_logs

```sql
CREATE TABLE initiative_progress_logs (
    id TEXT PRIMARY KEY,
    initiative_id TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status TEXT,
    notes TEXT,
    observed_metrics JSON DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (initiative_id) REFERENCES improvement_initiatives(id) ON DELETE CASCADE
);
```

## suggested_actions

```sql
CREATE TABLE suggested_actions (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    effort_estimate TEXT,
    impact_score INTEGER,
    owner_role TEXT,
    due_date_hint TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending',
    initiative_id TEXT,
    created_card_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (analysis_id) REFERENCES root_cause_analyses(id) ON DELETE CASCADE,
    FOREIGN KEY (node_id) REFERENCES root_cause_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (initiative_id) REFERENCES improvement_initiatives(id) ON DELETE SET NULL,
    FOREIGN KEY (created_card_id) REFERENCES cards(id) ON DELETE SET NULL
);
```

## status_reports

```sql
CREATE TABLE status_reports (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    shift_type TEXT,
    tags JSON DEFAULT '[]',
    content JSON DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft',
    auto_ticket_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    analysis_model TEXT,
    analysis_started_at TIMESTAMP WITH TIME ZONE,
    analysis_completed_at TIMESTAMP WITH TIME ZONE,
    confidence REAL,
    failure_reason TEXT,
    processing_meta JSON DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## status_report_cards

```sql
CREATE TABLE status_report_cards (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    card_id TEXT NOT NULL,
    link_role TEXT DEFAULT 'primary',
    confidence REAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES status_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);
```

## status_report_events

```sql
CREATE TABLE status_report_events (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSON DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES status_reports(id) ON DELETE CASCADE
);
```

## report_templates

```sql
CREATE TABLE report_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    audience TEXT,
    sections_json JSON DEFAULT '[]',
    branding JSON DEFAULT '{}',
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## generated_reports

```sql
CREATE TABLE generated_reports (
    id TEXT PRIMARY KEY,
    template_id TEXT,
    author_id TEXT,
    parameters_json JSON DEFAULT '{}',
    content TEXT NOT NULL,
    export_urls JSON DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES report_templates(id) ON DELETE SET NULL
);
```

## saved_filters

```sql
CREATE TABLE saved_filters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    definition JSON DEFAULT '{}',
    created_by TEXT NOT NULL,
    shared BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);
```

## similarity_feedback

```sql
CREATE TABLE similarity_feedback (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    related_id TEXT NOT NULL,
    related_type TEXT NOT NULL,
    is_relevant BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);
```

## competencies

```sql
CREATE TABLE competencies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    level TEXT NOT NULL,
    description TEXT,
    rubric JSON DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## competency_criteria

```sql
CREATE TABLE competency_criteria (
    id TEXT PRIMARY KEY,
    competency_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    weight REAL,
    intentionality_prompt TEXT,
    behavior_prompt TEXT,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (competency_id) REFERENCES competencies(id) ON DELETE CASCADE
);
```

## competency_evaluation_jobs

```sql
CREATE TABLE competency_evaluation_jobs (
    id TEXT PRIMARY KEY,
    competency_id TEXT,
    user_id TEXT,
    status TEXT DEFAULT 'pending',
    scope TEXT DEFAULT 'user',
    target_period_start DATE,
    target_period_end DATE,
    triggered_by TEXT DEFAULT 'manual',
    triggered_by_id TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    summary_stats JSON DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (competency_id) REFERENCES competencies(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (triggered_by_id) REFERENCES users(id) ON DELETE SET NULL
);
```

## competency_evaluations

```sql
CREATE TABLE competency_evaluations (
    id TEXT PRIMARY KEY,
    competency_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    scale INTEGER NOT NULL,
    score_value INTEGER NOT NULL,
    score_label TEXT NOT NULL,
    rationale TEXT,
    attitude_actions JSON DEFAULT '[]',
    behavior_actions JSON DEFAULT '[]',
    ai_model TEXT,
    triggered_by TEXT DEFAULT 'manual',
    job_id TEXT,
    context JSON DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (competency_id) REFERENCES competencies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (job_id) REFERENCES competency_evaluation_jobs(id) ON DELETE SET NULL
);
```

## competency_evaluation_items

```sql
CREATE TABLE competency_evaluation_items (
    id TEXT PRIMARY KEY,
    evaluation_id TEXT NOT NULL,
    criterion_id TEXT,
    score_value INTEGER NOT NULL,
    score_label TEXT NOT NULL,
    rationale TEXT,
    attitude_actions JSON DEFAULT '[]',
    behavior_actions JSON DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evaluation_id) REFERENCES competency_evaluations(id) ON DELETE CASCADE,
    FOREIGN KEY (criterion_id) REFERENCES competency_criteria(id) ON DELETE SET NULL
);
```

## daily_evaluation_quotas

```sql
CREATE TABLE daily_evaluation_quotas (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id TEXT NOT NULL,
    quota_date DATE NOT NULL,
    executed_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (owner_id, quota_date)
);
```

## quota_defaults

```sql
CREATE TABLE quota_defaults (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    card_daily_limit INTEGER NOT NULL DEFAULT 25,
    evaluation_daily_limit INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## user_quota_overrides

```sql
CREATE TABLE user_quota_overrides (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    card_daily_limit INTEGER,
    evaluation_daily_limit INTEGER,
    updated_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## analysis_sessions

```sql
CREATE TABLE analysis_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    request_text TEXT NOT NULL,
    notes TEXT,
    objective TEXT,
    auto_objective BOOLEAN NOT NULL DEFAULT FALSE,
    max_cards INTEGER NOT NULL DEFAULT 3,
    response_model TEXT,
    proposals JSON DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending',
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## appeal_generations

```sql
CREATE TABLE appeal_generations (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    subject_type VARCHAR(32) NOT NULL,
    subject_value VARCHAR(255) NOT NULL,
    flow JSON DEFAULT '[]',
    formats JSON DEFAULT '[]',
    content_json JSON DEFAULT '{}',
    token_usage JSON DEFAULT '{}',
    warnings JSON DEFAULT '[]',
    generation_status VARCHAR(32) NOT NULL DEFAULT 'success',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## api_credentials

```sql
CREATE TABLE api_credentials (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider TEXT NOT NULL UNIQUE,
    encrypted_secret TEXT NOT NULL,
    secret_hint TEXT,
    is_active BOOLEAN NOT NULL DEFAULT False,
    model TEXT,
    created_by_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL
);
```
