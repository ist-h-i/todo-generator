import type { Page } from '@playwright/test';

import type { ApiMockMap } from './api-mock';
import { mockApi } from './api-mock';
import { setLocalStorage } from './storage';
import {
  AUTH_TOKEN_STORAGE_KEY,
  BOARD_LABELS,
  BOARD_LAYOUT,
  BOARD_STATUSES,
  BOARD_TEMPLATES,
  COMMENTS_EMPTY,
  TEST_TOKEN,
  TEST_USER,
} from './test-data';

type WorkspaceMockOverrides = ApiMockMap;

export const setupWorkspaceMocks = async (
  page: Page,
  overrides: WorkspaceMockOverrides = {},
): Promise<void> => {
  await setLocalStorage(page, { [AUTH_TOKEN_STORAGE_KEY]: TEST_TOKEN });

  await mockApi(page, {
    'GET /auth/me': { json: TEST_USER },
    'GET /statuses': { json: BOARD_STATUSES },
    'GET /labels': { json: BOARD_LABELS },
    'GET /workspace/templates': { json: BOARD_TEMPLATES },
    'GET /board-layouts': { json: BOARD_LAYOUT },
    'PUT /board-layouts': { json: BOARD_LAYOUT },
    'GET /cards': { json: [] },
    'GET /comments': { json: COMMENTS_EMPTY },
    ...overrides,
  });
};
