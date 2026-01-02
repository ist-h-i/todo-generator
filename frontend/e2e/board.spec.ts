import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { CardResponse } from '../src/app/core/api/cards-api';

import type { ApiMockMap } from './support/api-mock';
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

const setupBoardSession = async (
  page: Page,
  cards: readonly CardResponse[],
  overrides: ApiMockMap = {},
): Promise<void> => {
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
    ...overrides,
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

  test('toggles quick filters and grouping', async ({ page }) => {
    const assignedToUser = TEST_USER.nickname ?? TEST_USER.email;
    await setupBoardSession(page, [
      makeCardResponse({
        id: 'card-quick-1',
        title: 'Fix bug',
        summary: 'Investigate crash',
        status_id: 'todo',
        label_ids: ['bug'],
        assignees: [assignedToUser],
      }),
      makeCardResponse({
        id: 'card-quick-2',
        title: 'Docs update',
        summary: 'Refresh guide',
        status_id: 'in-progress',
        label_ids: ['docs'],
        assignees: [assignedToUser],
      }),
    ]);

    await gotoBoard(page);

    const quickFilter = page.locator('.board-filters__quick-list .button').first();
    await expect(quickFilter).toHaveAttribute('aria-pressed', 'false');
    await quickFilter.click();
    await expect(quickFilter).toHaveAttribute('aria-pressed', 'true');

    await page.locator('.board-filters__view-actions .button').nth(1).click();
    await expect(page.locator('.board-card__actions').first()).toBeVisible();
  });

  test('manages comments, subtasks, and delete confirmation', async ({ page }) => {
    const now = '2025-01-01T00:00:00Z';

    await setupBoardSession(
      page,
      [
        makeCardResponse({
          id: 'card-detail',
          title: 'Fix auth',
          summary: 'Resolve login bug',
          status_id: 'todo',
          label_ids: ['bug'],
          subtasks: [
            { id: 'subtask-1', title: 'Investigate logs', status: 'todo' },
          ],
        }),
      ],
      {
        'GET /comments': {
          json: [
            {
              id: 'comment-1',
              card_id: 'card-detail',
              content: 'Initial note',
              subtask_id: null,
              author_id: 'user-1',
              author_nickname: 'Tester',
              created_at: now,
              updated_at: now,
            },
            {
              id: 'comment-orphan',
              card_id: 'card-detail',
              content: 'Orphaned note',
              subtask_id: 'missing-subtask',
              author_id: 'user-1',
              author_nickname: 'Tester',
              created_at: now,
              updated_at: now,
            },
          ],
        },
        'POST /comments': {
          json: {
            id: 'comment-2',
            card_id: 'card-detail',
            content: 'New comment',
            subtask_id: null,
            author_id: 'user-1',
            author_nickname: 'Tester',
            created_at: now,
            updated_at: now,
          },
        },
        'PUT /comments/comment-1': {
          json: {
            id: 'comment-1',
            card_id: 'card-detail',
            content: 'Updated note',
            subtask_id: null,
            author_id: 'user-1',
            author_nickname: 'Tester',
            created_at: now,
            updated_at: now,
          },
        },
        'DELETE /comments/comment-1': { status: 204 },
        'POST /cards/card-detail/subtasks': {
          json: {
            id: 'subtask-2',
            title: 'New subtask',
            status: 'todo',
            assignee: null,
            estimate_hours: null,
            due_date: null,
          },
        },
        'DELETE /cards/card-detail': { status: 204 },
      },
    );

    await gotoBoard(page);

    await page.locator('.board-card__select', { hasText: 'Fix auth' }).click();
    await expect(page.locator('.board-detail')).toBeVisible();

    await expect(page.locator('.comment-pane__section--orphaned')).toBeVisible();

    const cardCommentForm = page.locator('.card-comments form.comment-form');
    await cardCommentForm.locator('textarea').fill('New comment');
    await cardCommentForm.locator('button[type="submit"]').click();
    await expect(page.locator('.card-comments .comment-list__message', { hasText: 'New comment' })).toBeVisible();

    const commentItem = page.locator('.card-comments .comment-list__item', { hasText: 'Initial note' });
    await commentItem.locator('.comment-list__edit').click();
    await cardCommentForm.locator('textarea').fill('Updated note');
    await cardCommentForm.locator('button[type="submit"]').click();
    await expect(page.locator('.card-comments .comment-list__message', { hasText: 'Updated note' })).toBeVisible();

    const updatedItem = page.locator('.card-comments .comment-list__item', { hasText: 'Updated note' });
    await updatedItem.locator('.comment-list__remove').click();
    await expect(page.locator('.card-comments .comment-list__message', { hasText: 'Updated note' })).toHaveCount(0);

    const newSubtaskForm = page.locator('form.subtask-editor__form');
    await newSubtaskForm.locator('input[type="text"]').first().fill('New subtask');
    await newSubtaskForm.locator('button[type="submit"]').click();
    const newSubtaskTitle = page
      .locator('.subtask-editor__title-field input.subtask-editor__input')
      .last();
    await expect(newSubtaskTitle).toHaveValue('New subtask');

    const deleteButton = page.locator('.board-detail button.button--danger');
    page.once('dialog', async (dialog) => dialog.dismiss());
    await deleteButton.click();
    await expect(page.locator('.board-detail')).toBeVisible();

    page.once('dialog', async (dialog) => dialog.accept());
    await deleteButton.click();
    await expect(page.locator('.board-detail')).toHaveCount(0);
  });
});
