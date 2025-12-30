# Analytics Insights（Snapshots + 免疫マップ）設計詳細

## Document Control

| Field | Value |
| --- | --- |
| Version | 3.0 |
| Author | Product / Engineering |
| Last Updated | 2025-12-29 |
| Status | Draft |

## 1. 目的

- Analytics の中心は「スナップショット」と「免疫マップ生成」の 2 つ。
- 旧「なぜなぜ分析（Why-Why）」/ Suggested Actions / Continuous Improvement は廃止し、免疫マップへ一本化する。

## 2. 構成

### 2.1 フロントエンド

- `AnalyticsPageComponent` がスナップショット表示と免疫マップ生成フォームを提供する。
- `ImmunityMapGateway` が `POST /analysis/immunity-map` を呼び出す。

### 2.2 バックエンド

- `/analytics/snapshots` はスナップショット CRUD を提供する（管理者のみ）。
- `/analysis/immunity-map` は A（ユーザー入力）と AI 推測（B〜F）から Mermaid を返す（認証ユーザー）。

## 3. 主要フロー

### 3.1 スナップショット

1. 管理者が期間・メトリクス・ナラティブを入力して作成する。
2. Analytics 画面で一覧/単体を参照する。

### 3.2 免疫マップ生成

1. ユーザーが A（やるべき/やれない/やりたい）と背景（任意）を入力する。
2. フロントが `POST /analysis/immunity-map` を実行する。
3. サーバが Gemini の構造化出力で B〜F とエッジを受け取り、要件に従い「空・不正・参照切れ・不許可接続」を除去する。
4. サーバが Mermaid（単一ドキュメント）を組み立てて返す。
5. UI は Mermaid を表示し、コピーと Mermaid Live Editor への導線を提供する。

## 4. 非表示ルール

- `docs/features/immunity-map/requirements.md` の「内容がない要素/線は非表示」を厳守する（サーバ側で保証する）。

## 5. 非対象（後続検討）

- 免疫マップの永続化・履歴・編集 UI
- Suggested Actions の生成/管理

## 6. 参考

- `docs/features/immunity-map/requirements.md`
- `docs/features/immunity-map/detail-design.md`
