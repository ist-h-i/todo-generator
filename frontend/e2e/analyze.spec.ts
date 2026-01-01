import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { setLocalStorage } from './support/storage';
import {
  AUTH_TOKEN_STORAGE_KEY,
  BOARD_LABELS,
  BOARD_LAYOUT,
  BOARD_STATUSES,
  BOARD_TEMPLATES,
  TEST_TOKEN,
  TEST_USER,
  makeCardResponse,
} from './support/test-data';

const setupAnalyzeSession = async (page: Page): Promise<void> => {
  await setLocalStorage(page, { [AUTH_TOKEN_STORAGE_KEY]: TEST_TOKEN });

  await mockApi(page, {
    'GET /auth/me': { json: TEST_USER },
    'GET /statuses': { json: BOARD_STATUSES },
    'GET /labels': { json: BOARD_LABELS },
    'GET /workspace/templates': { json: BOARD_TEMPLATES },
    'GET /board-layouts': { json: BOARD_LAYOUT },
    'GET /cards': { json: [] },
    'POST /analysis': {
      json: {
        model: 'test-model',
        warnings: [],
        proposals: [
          {
            title: 'Improve login',
            summary: 'Fix login issues',
            status: 'todo',
            labels: ['bug'],
            priority: 'high',
            subtasks: [{ title: 'Investigate', description: 'Check recent errors' }],
          },
        ],
      },
    },
    'POST /cards': {
      json: makeCardResponse({
        id: 'card-1',
        title: 'Improve login',
        summary: 'Fix login issues',
        status_id: 'todo',
        label_ids: ['bug'],
      }),
    },
  });
};

test.describe('Analyze', () => {
  test('creates proposals from notes and publishes a card', async ({ page }) => {
    await setupAnalyzeSession(page);

    await page.goto('/input');

    await page.getByLabel(/^ノート/).fill('ユーザーからのフィードバックを整理');
    await page.getByRole('button', { name: 'タスク案を作成' }).click();

    await expect(page.getByText(/提案\s*1/)).toBeVisible();
    await expect(page.getByPlaceholder('カードのタイトルを入力').first()).toHaveValue(
      'Improve login',
    );

    await page.getByRole('button', { name: 'この案をカードに追加' }).click();
    await expect(page.getByText('ボードに追加しました')).toBeVisible();
  });
});
