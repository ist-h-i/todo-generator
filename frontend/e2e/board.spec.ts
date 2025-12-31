import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { CardResponse } from '../src/app/core/api/cards-api';

import { mockApi } from './support/api-mock';
import { setLocalStorage } from './support/storage';
import {
  AUTH_TOKEN_STORAGE_KEY,
  BOARD_LABELS,
  BOARD_LAYOUT,
  BOARD_STATUSES,
  BOARD_TEMPLATES,
  COMMENTS_EMPTY,
  TEST_TOKEN,
  TEST_USER,
  makeCardResponse,
} from './support/test-data';

const setupBoardSession = async (page: Page, cards: readonly CardResponse[]): Promise<void> => {
  await setLocalStorage(page, { [AUTH_TOKEN_STORAGE_KEY]: TEST_TOKEN });

  await mockApi(page, {
    'GET /auth/me': { json: TEST_USER },
    'GET /statuses': { json: BOARD_STATUSES },
    'GET /labels': { json: BOARD_LABELS },
    'GET /workspace/templates': { json: BOARD_TEMPLATES },
    'GET /board-layouts': { json: { ...BOARD_LAYOUT, board_grouping: 'status' } },
    'PUT /board-layouts': { json: { ...BOARD_LAYOUT, board_grouping: 'status' } },
    'GET /cards': { json: cards },
    'GET /comments': { json: COMMENTS_EMPTY },
  });
};

test.describe('Board', () => {
  test('renders empty state when there are no cards', async ({ page }) => {
    await setupBoardSession(page, []);

    await page.goto('/board');

    await expect(page.getByRole('heading', { name: 'カード管理ボード' })).toBeVisible();
    await expect(page.getByPlaceholder('キーワードでカードを検索')).toBeVisible();
    await expect(page.getByText('カードがありません').first()).toBeVisible();
  });

  test('filters cards by search and clears filters', async ({ page }) => {
    await setupBoardSession(page, [
      makeCardResponse({ id: 'card-1', title: 'Fix bug', summary: 'Fix login', status_id: 'todo' }),
      makeCardResponse({
        id: 'card-2',
        title: 'Write docs',
        summary: 'Update README',
        status_id: 'todo',
        label_ids: ['docs'],
      }),
    ]);

    await page.goto('/board');
    await expect(page.getByText('Fix bug')).toBeVisible();
    await expect(page.getByText('Write docs')).toBeVisible();

    await page.getByPlaceholder('キーワードでカードを検索').fill('Fix');

    await expect(page.getByText('Fix bug')).toBeVisible();
    await expect(page.getByText('Write docs')).toHaveCount(0);

    await page.getByRole('button', { name: 'フィルターをクリア' }).click();

    await expect(page.getByPlaceholder('キーワードでカードを検索')).toHaveValue('');
    await expect(page.getByText('Fix bug')).toBeVisible();
    await expect(page.getByText('Write docs')).toBeVisible();
  });

  test('opens and closes the card detail drawer', async ({ page }) => {
    await setupBoardSession(page, [
      makeCardResponse({
        id: 'card-1',
        title: 'Fix bug',
        summary: 'Fix login flow',
        status_id: 'todo',
      }),
    ]);

    await page.goto('/board');

    await page.getByRole('button', { name: /Fix bug/ }).click();

    const detail = page.locator('aside.board-detail');
    await expect(detail).toBeVisible();
    await expect(detail.getByRole('heading', { name: 'Fix bug' })).toBeVisible();

    await detail.getByRole('button', { name: '閉じる' }).click();
    await expect(detail).toHaveCount(0);
  });
});
