import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { setLocalStorage } from './support/storage';
import {
  AUTH_TOKEN_STORAGE_KEY,
  LEGACY_AUTH_TOKEN_STORAGE_KEY,
  TEST_USER,
} from './support/test-data';

test.describe('Routing / Auth Guard', () => {
  test('unauthenticated access redirects to /login', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('#login-heading')).toBeVisible();
  });

  test('stale token is cleared and redirects to /login', async ({ page }) => {
    await setLocalStorage(page, { [AUTH_TOKEN_STORAGE_KEY]: 'stale-token' });
    await mockApi(page, {
      'GET /auth/me': { status: 401, json: { detail: 'expired token' } },
    });

    await page.goto('/board');

    await expect(page).toHaveURL(/\/login/);

    const storedToken = await page.evaluate(() =>
      window.localStorage.getItem('verbalize-yourself/auth-token'),
    );
    expect(storedToken).toBeNull();
  });

  test('legacy token migrates to new storage key', async ({ page }) => {
    await setLocalStorage(page, { [LEGACY_AUTH_TOKEN_STORAGE_KEY]: 'legacy-token' });
    await mockApi(page, {
      'GET /auth/me': { json: TEST_USER },
    });

    await page.goto('/some-unknown-route');

    await expect(page.getByRole('heading', { name: 'ページが見つかりませんでした' })).toBeVisible();

    const migratedToken = await page.evaluate(() =>
      window.localStorage.getItem('verbalize-yourself/auth-token'),
    );
    expect(migratedToken).toBe('legacy-token');

    const legacyToken = await page.evaluate(() =>
      window.localStorage.getItem('todo-generator/auth-token'),
    );
    expect(legacyToken).toBeNull();
  });
});

