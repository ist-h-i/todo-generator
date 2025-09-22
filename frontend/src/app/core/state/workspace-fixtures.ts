import { Card, Label, Status, Subtask, TemplatePreset, WorkspaceSettings } from '@core/models';
import { createId } from '@core/utils/create-id';

export const INITIAL_LABELS: Label[] = [
  { id: 'frontend', name: 'フロントエンド', color: '#38bdf8' },
  { id: 'backend', name: 'バックエンド', color: '#a855f7' },
  { id: 'ux', name: 'UX', color: '#ec4899' },
  { id: 'ai', name: 'AI', color: '#f97316' },
];

export const INITIAL_STATUSES: Status[] = [
  { id: 'todo', name: 'To Do', category: 'todo', order: 1, color: '#64748b' },
  { id: 'in-progress', name: 'In Progress', category: 'in-progress', order: 2, color: '#2563eb' },
  { id: 'review', name: 'Review', category: 'in-progress', order: 3, color: '#9333ea' },
  { id: 'done', name: 'Done', category: 'done', order: 4, color: '#16a34a' },
];

export const INITIAL_TEMPLATES: TemplatePreset[] = [
  {
    id: 'ai-template',
    name: 'AI 改善サイクル',
    description: 'ChatGPT 改修用のチェックリストテンプレート',
    defaultStatusId: 'todo',
    defaultLabelIds: ['ai'],
  },
  {
    id: 'ux-template',
    name: 'UX 検証',
    description: 'プロトタイプ検証とユーザーテスト',
    defaultStatusId: 'in-progress',
    defaultLabelIds: ['ux'],
  },
];

const buildSubtasks = (titles: readonly string[]): Subtask[] =>
  titles.map((title, index) => ({
    id: createId(),
    title,
    status: index === 0 ? 'in-progress' : 'todo',
    assignee: index === 0 ? '田中太郎' : undefined,
    estimateHours: 3,
  }));

export const INITIAL_CARDS: Card[] = [
  {
    id: createId(),
    title: 'ChatGPT プロンプトの改善',
    summary: '分析精度向上のための新しいプロンプト設計を検証します。',
    statusId: 'in-progress',
    labelIds: ['ai'],
    priority: 'high',
    storyPoints: 5,
    assignee: '田中太郎',
    confidence: 0.74,
    subtasks: buildSubtasks(['事例収集', '評価実験', 'レビュー共有']),
    comments: [],
    activities: [],
  },
  {
    id: createId(),
    title: 'ボードのアクセシビリティ監査',
    summary: 'キーボード操作とスクリーンリーダー読み上げを改善します。',
    statusId: 'review',
    labelIds: ['ux'],
    priority: 'medium',
    storyPoints: 3,
    assignee: '佐藤花子',
    subtasks: buildSubtasks(['想定シナリオ整理', 'VoiceOver テスト']),
    comments: [],
    activities: [],
  },
  {
    id: createId(),
    title: 'GraphQL API の準備',
    summary: 'カード取得と更新 API を GraphQL で再設計します。',
    statusId: 'todo',
    labelIds: ['backend'],
    priority: 'urgent',
    storyPoints: 8,
    assignee: '李開発',
    subtasks: buildSubtasks(['スキーマ定義', 'Resolver 実装', 'E2E テスト']),
    comments: [],
    activities: [],
  },
  {
    id: createId(),
    title: '設定画面のテンプレート拡充',
    summary: 'テンプレートの並び替えと検索機能を追加します。',
    statusId: 'done',
    labelIds: ['frontend'],
    priority: 'medium',
    storyPoints: 2,
    assignee: '田中太郎',
    subtasks: buildSubtasks(['UI 設計', 'ストア連携']),
    comments: [],
    activities: [],
  },
];

export const INITIAL_SETTINGS: WorkspaceSettings = {
  defaultStatusId: 'todo',
  defaultAssignee: '田中太郎',
  timezone: 'Asia/Tokyo',
  statuses: INITIAL_STATUSES,
  labels: INITIAL_LABELS,
  templates: INITIAL_TEMPLATES,
  storyPointScale: [1, 2, 3, 5, 8, 13],
};
