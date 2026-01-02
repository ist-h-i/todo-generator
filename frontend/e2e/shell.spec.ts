import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { removeLocalStorage, setLocalStorage } from './support/storage';
import {
  AUTH_TOKEN_STORAGE_KEY,
  LEGACY_THEME_STORAGE_KEY,
  TEST_TOKEN,
  TEST_USER,
  THEME_STORAGE_KEY,
} from './support/test-data';

const setupAuthenticatedUser = async (page: Page): Promise<void> => {
  await setLocalStorage(page, { [AUTH_TOKEN_STORAGE_KEY]: TEST_TOKEN });
  await mockApi(page, {
    'GET /auth/me': { json: TEST_USER },
  });
};

test.describe('Shell', () => {
  test('help dialog opens and closes with Escape', async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto('/some-unknown-route');

    await page.getByRole('button', { name: 'Verbalize Yourself の使い方を開く' }).click();
    await expect(page.locator('#help-dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#help-dialog')).toHaveCount(0);
  });

  test('theme preference cycles and persists', async ({ page }) => {
    await removeLocalStorage(page, [THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY]);
    await setupAuthenticatedUser(page);

    await page.goto('/some-unknown-route');

    const initialPreference = await page.evaluate(() =>
      window.localStorage.getItem('verbalize-yourself:theme-preference'),
    );
    expect(initialPreference).toBe('system');

    const themeButton = page.locator('button.shell-quick-action');
    await themeButton.click();

    await expect
      .poll(() =>
        page.evaluate(() => window.localStorage.getItem('verbalize-yourself:theme-preference')),
      )
      .toBe('dark');
    await expect(page.locator('html')).toHaveClass(/dark/);

    await themeButton.click();
    await expect
      .poll(() =>
        page.evaluate(() => window.localStorage.getItem('verbalize-yourself:theme-preference')),
      )
      .toBe('light');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('legacy theme preference migrates to new key', async ({ page }) => {
    await setLocalStorage(page, { [LEGACY_THEME_STORAGE_KEY]: 'dark' });
    await setupAuthenticatedUser(page);

    await page.goto('/some-unknown-route');

    const migratedPreference = await page.evaluate(() =>
      window.localStorage.getItem('verbalize-yourself:theme-preference'),
    );
    expect(migratedPreference).toBe('dark');

    const legacyPreference = await page.evaluate(() =>
      window.localStorage.getItem('todo-generator:theme-preference'),
    );
    expect(legacyPreference).toBeNull();
    expect(await page.locator('html').evaluate((el) => el.classList.contains('dark'))).toBe(true);
  });

  test('logout clears token and returns to login', async ({ page }) => {
    await setupAuthenticatedUser(page);

    await page.goto('/some-unknown-route');
    await page.getByRole('button', { name: 'ログアウト' }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('#login-heading')).toBeVisible();

    const storedToken = await page.evaluate(() =>
      window.localStorage.getItem('verbalize-yourself/auth-token'),
    );
    expect(storedToken).toBeNull();
  });

  test('authenticated user sees 404 page for unknown route', async ({ page }) => {
    await setupAuthenticatedUser(page);

    await page.goto('/does-not-exist');

    await expect(page.getByRole('heading', { name: 'ページが見つかりませんでした' })).toBeVisible();
  });
});
