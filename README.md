# Verbalize Yourself

Verbalize Yourself は Angular 20 フロントエンドと FastAPI バックエンドを組み合わせた AI ガイド付きリフレクションワークスペースで、カード管理・分析・レポート作成を一体化し、ChatGPT による自動化で内省サイクルを加速します。【F:frontend/src/app/app.routes.ts†L1-L73】【F:backend/app/main.py†L1-L69】

## Feature Highlights
- **Workspace task board** – ラベルやステータスでグルーピングされたカードをドラッグ＆ドロップで並べ替え、クイックフィルターやテンプレートでワークフローを整えます。【F:frontend/src/app/features/board/page.ts†L1-L160】【F:frontend/src/app/core/state/workspace-store.ts†L1-L200】
- **AI-assisted intake & daily reporting** – 自由入力の振り返りメモを AI が提案カードへ構造化し、日報/週報の送信ではセクションから提案タスクを生成して記録します。【F:backend/app/routers/analysis.py†L1-L27】【F:backend/app/services/chatgpt.py†L43-L190】【F:backend/app/routers/daily_reports.py†L1-L108】【F:frontend/src/app/features/reports/reports-page.component.ts†L1-L157】
- **Analytics & continuous improvement** – 管理者はスナップショットや Why-Why 分析を作成し、根本原因ノードや改善アクション、イニシアチブの進捗をダッシュボードで追跡できます。【F:backend/app/routers/analytics.py†L1-L200】【F:backend/app/models.py†L301-L439】【F:frontend/src/app/features/analytics/page.ts†L1-L112】【F:frontend/src/app/core/state/continuous-improvement-store.ts†L1-L200】
- **Appeal narrative generation** – アピール文生成 API が推奨フローと複数フォーマットを提示し、ChatGPT 応答とフォールバックテンプレートを統合して成果ストーリーを保存します。【F:backend/app/routers/appeals.py†L1-L27】【F:backend/app/services/appeals.py†L1-L200】【F:backend/app/services/appeal_prompts.py†L1-L180】
- **Governance & competency management** – API 資格情報の暗号化管理、評価ルーブリック、クオータ設定などの管理機能で運用ガードレールを構築します。【F:backend/app/routers/admin_settings.py†L1-L140】【F:backend/app/routers/competencies.py†L1-L120】

## Technology Stack
- **Frontend** – Angular 20 スタンドアロンコンポーネント、CDK Drag & Drop、Signal ベースの状態管理、ESLint/Prettier を採用しています。【F:frontend/package.json†L1-L60】【F:frontend/src/app/features/board/page.ts†L1-L160】
- **Backend** – FastAPI + SQLAlchemy が REST ルーターとスキーマを提供し、ChatGPT クライアントが Responses API を JSON スキーマでラップします。【F:backend/app/main.py†L1-L69】【F:backend/app/schemas.py†L1-L1080】【F:backend/app/services/chatgpt.py†L43-L190】
- **Persistence & Background models** – カード、アナリティクス、Why-Why 分析、提案アクション、日報、アピール生成などを JSON カラム付きのリレーショナルモデルで管理します。【F:backend/app/models.py†L120-L780】

## Repository Layout
```
.
├── backend/                # FastAPI アプリケーションと ChatGPT 連携サービス
├── frontend/               # Angular 20 SPA
├── docs/                   # アーキテクチャ、開発ルール、機能別要件/詳細設計
├── scripts/                # 自動化スクリプト
└── start-localhost.bat     # Windows 用ワンコマンド起動
```
主なドキュメントは `docs/` にあり、`docs/features/` 配下で機能ごとの要件・詳細設計を管理しています。

## Getting Started
### Prerequisites
- Python 3.11 以上 (FastAPI・Ruff・Black を利用)。【F:pyproject.toml†L1-L28】
- Node.js / npm (Angular CLI とビルド/テストスクリプト用)。【F:frontend/package.json†L1-L60】
- OpenAI API キー (管理画面から保存し、ChatGPT クライアントが復号して利用)。【F:backend/app/services/chatgpt.py†L111-L157】【F:backend/app/routers/admin_settings.py†L22-L81】

### One-click startup on Windows
リポジトリルートで同梱スクリプトを実行すると仮想環境の作成、依存インストール、バックエンド/フロントエンドの起動まで自動化されます。
```
start-localhost.bat
```
スクリプトは FastAPI を <http://localhost:8000>、Angular 開発サーバーを <http://localhost:4200> で起動します。【F:start-localhost.bat†L1-L41】

### Manual startup (macOS/Linux)
1. **Backend**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   # Optional: lint/format toolchain
   pip install -r backend/requirements-dev.txt
   uvicorn app.main:app --app-dir backend --reload
   ```
   依存関係をインストールし、ホットリロード付きで FastAPI アプリを起動します。【F:backend/requirements.txt†L1-L13】【F:backend/app/main.py†L1-L69】

2. **Frontend** (別ターミナル)
   ```bash
   cd frontend
   npm install
   npm start
   ```
   `npm start` は Angular の開発サーバーを 4200 番ポートで立ち上げます。【F:frontend/package.json†L4-L12】

### Environment variables
バックエンドは Pydantic Settings で環境変数を読み込みます (例: DB 接続、CORS、ChatGPT 既定値、暗号鍵)。【F:backend/app/config.py†L10-L39】

## Running Tests & Quality Checks
Pull Request 前に自動チェックを実行してください。
```bash
# Backend
pytest backend/tests
ruff check backend
black --check backend/app backend/tests

# Frontend
cd frontend
npm test -- --watch=false
npm run lint
npm run format:check
```
`npm test` は Angular CLI (Karma) を利用し、ESLint と Prettier でスタイルを検証します。【F:frontend/package.json†L4-L18】

## Documentation & Architecture
- `docs/architecture.md` – システムコンテキストと主要コンポーネント。
- `docs/development-rules.md` – 開発プロセスと品質基準。
- `docs/features/appeal-generation/requirements.md` – アピール文生成の要件定義。
- `docs/features/appeal-generation/detail-design.md` – アピール文生成の詳細設計。
- `docs/features/analytics-insights/requirements.md` – 分析・継続的改善機能の要件。
- `docs/features/analytics-insights/detail-design.md` – 分析・継続的改善機能の実装設計。
- `docs/ui-design-system.md` – コンポーネントの UI ガイドライン。
