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

const gotoBoard = async (page: Page): Promise<void> => {
  await Promise.all([
    page.waitForResponse(
      (response) => response.request().method() === 'GET' && response.url().includes('/cards'),
    ),
    page.goto('/board'),
  ]);
};

test.describe('Board', () => {
  test('renders empty state when there are no cards', async ({ page }) => {
    await setupBoardSession(page, []);

    await gotoBoard(page);

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

    await gotoBoard(page);
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

    await gotoBoard(page);

    await page.getByRole('button', { name: /Fix bug/ }).click();

    const detail = page.locator('aside.board-detail');
    await expect(detail).toBeVisible();
    await expect(detail.getByRole('heading', { name: 'Fix bug' })).toBeVisible();

    await detail.getByRole('button', { name: '閉じる' }).click();
    await expect(detail).toHaveCount(0);
  });

  test('renders cards across all status columns', async ({ page }) => {
    await setupBoardSession(page, [
      makeCardResponse({
        id: 'card-todo',
        title: 'Card Todo',
        summary: 'Todo summary',
        status_id: 'todo',
      }),
      makeCardResponse({
        id: 'card-progress',
        title: 'Card In Progress',
        summary: 'Progress summary',
        status_id: 'in-progress',
      }),
      makeCardResponse({
        id: 'card-done',
        title: 'Card Done',
        summary: 'Done summary',
        status_id: 'done',
      }),
    ]);

    await gotoBoard(page);

    const statusColumn = (name: string) =>
      page
        .locator('.board-page__task-board .board-column')
        .filter({ has: page.getByRole('heading', { name }) });

    const expectCardInStatus = async (statusName: string, cardTitle: string): Promise<void> => {
      const column = statusColumn(statusName);
      const card = column.locator('.board-card', { hasText: cardTitle });
      await expect(card).toBeVisible();
      await expect(card.locator('.board-badge').first()).toHaveText(statusName);
    };

    await expectCardInStatus('ToDo', 'Card Todo');
    await expectCardInStatus('In Progress', 'Card In Progress');
    await expectCardInStatus('Done', 'Card Done');
  });

  test('renders subtasks across all status columns', async ({ page }) => {
    await setupBoardSession(page, [
      makeCardResponse({
        id: 'card-subtasks',
        title: 'Subtask Parent',
        summary: 'Subtasks summary',
        status_id: 'todo',
        subtasks: [
          { id: 'subtask-todo', title: 'Subtask Todo', status: 'todo' },
          { id: 'subtask-in-progress', title: 'Subtask In Progress', status: 'in-progress' },
          { id: 'subtask-done', title: 'Subtask Done', status: 'done' },
          { id: 'subtask-non-issue', title: 'Subtask Non Issue', status: 'non-issue' },
        ],
      }),
    ]);

    await gotoBoard(page);

    const subtaskColumns = page.locator('.board-page__subtask-board .subtask-column');
    await expect(subtaskColumns).toHaveCount(4);

    // Columns follow the subtask status order (todo, in-progress, done, non-issue).
    const subtaskTitles = [
      'Subtask Todo',
      'Subtask In Progress',
      'Subtask Done',
      'Subtask Non Issue',
    ];

    for (const [index, title] of subtaskTitles.entries()) {
      await expect(subtaskColumns.nth(index).getByText(title)).toBeVisible();
    }
  });
});
