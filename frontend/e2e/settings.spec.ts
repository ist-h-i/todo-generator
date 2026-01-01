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
} from './support/test-data';

const setupSettingsSession = async (page: Page): Promise<void> => {
  await setLocalStorage(page, { [AUTH_TOKEN_STORAGE_KEY]: TEST_TOKEN });

  let labels = [...BOARD_LABELS];

  await mockApi(page, {
    'GET /auth/me': { json: TEST_USER },
    'GET /statuses': { json: BOARD_STATUSES },
    'GET /labels': () => ({ json: labels }),
    'GET /workspace/templates': { json: BOARD_TEMPLATES },
    'GET /board-layouts': { json: BOARD_LAYOUT },
    'GET /cards': { json: [] },
    'POST /labels': ({ postData }) => {
      const payload = postData ? (JSON.parse(postData) as { name?: string; color?: string }) : {};
      const next = {
        id: `label-${labels.length + 1}`,
        name: payload.name ?? 'Untitled',
        color: payload.color ?? '#000000',
      };
      labels = [...labels, next];
      return { json: next };
    },
  });
};

test.describe('Settings', () => {
  test('adds a label and refreshes the list', async ({ page }) => {
    await setupSettingsSession(page);

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'ラベル設定' })).toBeVisible();

    await page.locator('#label-name').fill('Customer');
    await page.locator('#label-color').fill('#ff0000');
    await page.getByRole('button', { name: 'ラベルを追加' }).click();

    await expect(
      page.locator('.settings-label-list .page-list__title', { hasText: 'Customer' }),
    ).toBeVisible();
  });
});
