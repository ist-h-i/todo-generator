import type { BoardLayoutResponse } from '../../src/app/core/api/board-layouts-api';
import type { CardResponse } from '../../src/app/core/api/cards-api';
import type { CommentResponse } from '../../src/app/core/api/comments-api';
import type {
  LabelResponse,
  StatusResponse,
  WorkspaceTemplateResponse,
} from '../../src/app/core/api/workspace-config-api';
import type {
  AuthenticatedUser,
  RegistrationResponse,
  TokenResponse,
} from '../../src/app/core/models/auth';

export const AUTH_TOKEN_STORAGE_KEY = 'verbalize-yourself/auth-token';
export const LEGACY_AUTH_TOKEN_STORAGE_KEY = 'todo-generator/auth-token';
export const THEME_STORAGE_KEY = 'verbalize-yourself:theme-preference';
export const LEGACY_THEME_STORAGE_KEY = 'todo-generator:theme-preference';

export const TEST_NOW = '2025-01-01T00:00:00Z';

export const TEST_USER: AuthenticatedUser = {
  id: 'user-1',
  email: 'tester@example.com',
  is_admin: false,
  created_at: TEST_NOW,
  updated_at: TEST_NOW,
  nickname: 'テストユーザー',
  experience_years: 3,
  roles: ['ソフトウェアエンジニアリング / フロントエンド / Webアプリケーション開発'],
  bio: 'Playwright テストユーザーです。',
  avatar_url: null,
};

export const TEST_TOKEN = 'test-token';

export const TOKEN_RESPONSE: TokenResponse = {
  access_token: TEST_TOKEN,
  token_type: 'bearer',
  user: TEST_USER,
};

export const REGISTRATION_RESPONSE: RegistrationResponse = {
  message: 'ok',
  requires_approval: false,
  admin_email: null,
};

export const BOARD_STATUSES: StatusResponse[] = [
  { id: 'todo', name: 'ToDo', category: 'todo', order: 0, color: '#64748b', wip_limit: null },
  {
    id: 'in-progress',
    name: 'In Progress',
    category: 'in-progress',
    order: 1,
    color: '#2563eb',
    wip_limit: null,
  },
  { id: 'done', name: 'Done', category: 'done', order: 2, color: '#16a34a', wip_limit: null },
];

export const BOARD_LABELS: LabelResponse[] = [
  { id: 'bug', name: 'Bug', color: '#ef4444' },
  { id: 'docs', name: 'Docs', color: '#f59e0b' },
];

export const BOARD_TEMPLATES: WorkspaceTemplateResponse[] = [];

export const BOARD_LAYOUT: BoardLayoutResponse = {
  user_id: TEST_USER.id,
  board_grouping: null,
  board_layout: null,
  visible_fields: [],
  notification_settings: {},
  preferred_language: null,
  created_at: TEST_NOW,
  updated_at: TEST_NOW,
};

export const makeCardResponse = (overrides: Partial<CardResponse> & Pick<CardResponse, 'id' | 'title'>): CardResponse => {
  return {
    id: overrides.id,
    title: overrides.title,
    created_at: TEST_NOW,
    summary: overrides.summary ?? '',
    status_id: overrides.status_id ?? 'todo',
    label_ids: overrides.label_ids ?? [],
    ...overrides,
  };
};

export const COMMENTS_EMPTY: CommentResponse[] = [];

