import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import type { ApiMockMap } from './support/api-mock';
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

const setupAnalyzeSession = async (page: Page, overrides: ApiMockMap = {}): Promise<void> => {
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
    ...overrides,
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

  test('manual objective requires input before submit', async ({ page }) => {
    await setupAnalyzeSession(page);

    await page.goto('/input');

    const submitButton = page.locator('.analyze-page__submit');
    await expect(submitButton).toBeDisabled();

    await page.locator('.analyze-page__notes-input').fill('Capture a few notes.');
    await expect(submitButton).toBeEnabled();

    await page.locator('input[name="autoObjective"]').nth(1).click();
    await expect(page.locator('.analyze-page__objective-manual textarea')).toBeVisible();
    await expect(submitButton).toBeDisabled();

    await page.locator('.analyze-page__objective-manual textarea').fill('Define the objective.');
    await expect(submitButton).toBeEnabled();
  });

  test('analysis failure shows toast and error state', async ({ page }) => {
    await setupAnalyzeSession(page, {
      'POST /analysis': { status: 500, json: { detail: 'failed' } },
    });

    await page.goto('/input');

    await page.locator('.analyze-page__notes-input').fill('Some notes');
    await page.locator('.analyze-page__submit').click();

    const errorToast = page.locator('.analyze-page__toast[data-state="error"]');
    const errorAlert = page.locator('.app-alert--error');
    const globalError = page.locator('[role="alert"]');
    await expect(errorToast.or(errorAlert).or(globalError)).toBeVisible();
  });

  test('empty analysis result shows notice and empty state', async ({ page }) => {
    await setupAnalyzeSession(page, {
      'POST /analysis': { json: { model: 'test-model', warnings: [], proposals: [] } },
    });

    await page.goto('/input');

    await page.locator('.analyze-page__notes-input').fill('Some notes');
    await page.locator('.analyze-page__submit').click();

    await expect(page.locator('.analyze-page__toast[data-state="notice"]')).toBeVisible();
    await expect(page.locator('.analyze-page__proposal-list')).toHaveCount(0);
  });

  test('edits proposals and shows publish error on failure', async ({ page }) => {
    await setupAnalyzeSession(page, {
      'POST /analysis': {
        json: {
          model: 'test-model',
          warnings: ['Short notes'],
          proposals: [
            {
              title: 'Improve docs',
              summary: 'Update onboarding steps',
              status: 'todo',
              labels: ['docs'],
              priority: 'high',
              subtasks: [],
            },
          ],
        },
      },
      'POST /cards': { status: 500, json: { detail: 'failed' } },
    });

    await page.goto('/input');

    await page.locator('.analyze-page__notes-input').fill('Some notes');
    await page.locator('.analyze-page__submit').click();

    await expect(page.locator('.app-alert--notice')).toBeVisible();

    const proposal = page.locator('.analyze-page__proposal').first();

    const bugLabel = proposal.getByRole('button', { name: 'Bug' });
    await expect(bugLabel).toHaveClass(/button--ghost/);
    await bugLabel.click();
    await expect(bugLabel).not.toHaveClass(/button--ghost/);

    await proposal.locator('.analyze-page__subtask-add').click();
    await expect(proposal.locator('.analyze-page__subtask-item')).toHaveCount(1);

    await proposal.locator('input.form-control').first().fill('');
    await expect(proposal.locator('button.button--secondary')).toBeDisabled();

    await proposal.locator('input.form-control').first().fill('Improve docs');
    await proposal.locator('button.button--secondary').click();

    await expect(page.locator('.analyze-page__toast--inline[data-state="error"]')).toBeVisible();
  });
});
