# Analytics Insights Requirements

## Document Control

| Field | Value |
| --- | --- |
| Version | 2.1 |
| Author | Product / Engineering |
| Last Updated | 2025-12-30 |
| Status | Draft |

## 1. Background

- 「なぜなぜ分析（Why-Why）」は廃止し、免疫マップ（A～F）へ置換する。
- Mermaid Live Editor でそのまま可視化できる Mermaid フローチャートを、単一ドキュメントとして出力する。
- 免疫マップの起点（A）はユーザー手入力を前提とせず、日報週報やタスクカード履歴から AI が候補を生成し、カード選択で開始できるようにする。

## 2. Scope

### In Scope

- Analytics スナップショットの作成・参照（`/analytics/snapshots`）。
- 免疫マップ候補の生成（`/analysis/immunity-map/candidates`）。
- 免疫マップの生成（`/analysis/immunity-map`）と Mermaid 出力。

### Out of Scope

- Why-Why（Root Cause）ツリー、Suggested Actions の生成/管理。

## 3. References

- `docs/features/immunity-map/requirements.md`
- `docs/features/immunity-map/detail-design.md`

