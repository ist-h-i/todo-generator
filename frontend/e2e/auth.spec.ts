import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import {
  BOARD_LABELS,
  BOARD_LAYOUT,
  BOARD_STATUSES,
  BOARD_TEMPLATES,
  COMMENTS_EMPTY,
  REGISTRATION_RESPONSE,
  TEST_TOKEN,
  TEST_USER,
  TOKEN_RESPONSE,
  makeCardResponse,
} from './support/test-data';

test.describe('Auth', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('#login-heading')).toBeVisible();
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'サインイン' })).toBeDisabled();
  });

  test('login form shows inline errors on submit', async ({ page }) => {
    await page.goto('/login');

    await page.locator('form.auth-form').dispatchEvent('submit');

    await expect(page.locator('#login-email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#login-email')).toHaveAttribute('aria-describedby', 'login-email-error');
    await expect(page.locator('#login-email-error')).toBeVisible();

    await expect(page.locator('#login-password')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#login-password')).toHaveAttribute(
      'aria-describedby',
      'login-password-error',
    );
    await expect(page.locator('#login-password-error')).toBeVisible();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'サインイン' })).toBeDisabled();
  });

  test('login ↔ register toggle resets validation state', async ({ page }) => {
    await page.goto('/login');

    await page.locator('form.auth-form').dispatchEvent('submit');
    await expect(page.locator('#login-email-error')).toBeVisible();

    await page.getByRole('button', { name: '新規登録はこちら' }).click();
    await expect(page.locator('#register-heading')).toBeVisible();

    await page.getByRole('button', { name: 'ログインはこちら' }).click();
    await expect(page.locator('#login-heading')).toBeVisible();

    await expect(page.locator('#login-email-error')).toHaveCount(0);
    await expect(page.locator('#login-password-error')).toHaveCount(0);
  });

  test('register form shows inline errors on submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '新規登録はこちら' }).click();

    await page.locator('form.auth-form').dispatchEvent('submit');

    await expect(page.locator('#register-nickname')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#register-nickname-error')).toBeVisible();
    await expect(page.locator('#register-email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#register-email-error')).toBeVisible();
    await expect(page.locator('#register-password')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#register-password-error')).toBeVisible();
    await expect(page.locator('#register-confirm-password')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#register-confirm-error')).toBeVisible();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'アカウントを作成' })).toBeDisabled();
  });

  test('register form shows confirm mismatch error', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '新規登録はこちら' }).click();

    await page.locator('#register-nickname').fill('Tester');
    await page.locator('#register-email').fill('tester@example.com');
    await page.locator('#register-password').fill('12345678');
    await page.locator('#register-confirm-password').fill('12345679');

    await expect(page.locator('#register-confirm-error')).toBeVisible();
    await expect(page.getByRole('button', { name: 'アカウントを作成' })).toBeDisabled();
  });

  test('login API error shows alert and stays on login', async ({ page }) => {
    await mockApi(page, {
      'POST /auth/login': { status: 401, json: { detail: 'invalid credentials' } },
    });

    await page.goto('/login');
    await page.locator('#login-email').fill('tester@example.com');
    await page.locator('#login-password').fill('12345678');
    await page.getByRole('button', { name: 'サインイン' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('register API error shows alert', async ({ page }) => {
    await mockApi(page, {
      'POST /auth/register': { status: 409, json: { detail: 'already exists' } },
    });

    await page.goto('/login');
    await page.getByRole('button', { name: '新規登録はこちら' }).click();
    await page.locator('#register-nickname').fill('Tester');
    await page.locator('#register-email').fill('tester@example.com');
    await page.locator('#register-password').fill('12345678');
    await page.locator('#register-confirm-password').fill('12345678');
    await page.getByRole('button', { name: 'アカウントを作成' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('#register-heading')).toBeVisible();
  });

  test('login success navigates to board and stores token', async ({ page }) => {
    await mockApi(page, {
      'POST /auth/login': { json: TOKEN_RESPONSE },
      'GET /auth/me': { json: TEST_USER },
      'GET /statuses': { json: BOARD_STATUSES },
      'GET /labels': { json: BOARD_LABELS },
      'GET /workspace/templates': { json: BOARD_TEMPLATES },
      'GET /cards': {
        json: [
          makeCardResponse({
            id: 'card-1',
            title: 'Fix bug',
            summary: 'Fix broken login flow',
            status_id: 'todo',
            label_ids: ['bug'],
          }),
        ],
      },
      'GET /comments': { json: COMMENTS_EMPTY },
      'GET /board-layouts': { json: BOARD_LAYOUT },
      'PUT /board-layouts': { json: BOARD_LAYOUT },
    });

    await page.goto('/login');
    await page.locator('#login-email').fill('tester@example.com');
    await page.locator('#login-password').fill('12345678');
    await page.getByRole('button', { name: 'サインイン' }).click();

    await expect(page).toHaveURL(/\/board/);
    await expect(page.getByRole('heading', { name: 'カード管理ボード' })).toBeVisible();

    const storedToken = await page.evaluate(() =>
      window.localStorage.getItem('verbalize-yourself/auth-token'),
    );
    expect(storedToken).toBe(TEST_TOKEN);
  });

  test('register success returns to login (no session token)', async ({ page }) => {
    await mockApi(page, {
      'POST /auth/register': { json: REGISTRATION_RESPONSE },
    });

    await page.goto('/login');
    await page.getByRole('button', { name: '新規登録はこちら' }).click();
    await page.locator('#register-nickname').fill('Tester');
    await page.locator('#register-email').fill('tester@example.com');
    await page.locator('#register-password').fill('12345678');
    await page.locator('#register-confirm-password').fill('12345678');
    await page.getByRole('button', { name: 'アカウントを作成' }).click();

    await expect(page).toHaveURL(/\/login/);
    const registerHeading = page.locator('#register-heading');
    if ((await registerHeading.count()) > 0) {
      await expect(registerHeading).toBeVisible();
      await expect(page.locator('#register-nickname')).toHaveValue('');
      await expect(page.locator('#register-email')).toHaveValue('');
      await expect(page.locator('#register-password')).toHaveValue('');
      await expect(page.locator('#register-confirm-password')).toHaveValue('');
      await expect(page.getByRole('button', { name: 'アカウントを作成' })).toBeDisabled();
    } else {
      await expect(page.locator('#login-heading')).toBeVisible();
    }

    const storedToken = await page.evaluate(() =>
      window.localStorage.getItem('verbalize-yourself/auth-token'),
    );
    expect(storedToken).toBeNull();
  });

  test('login input validation blocks submission', async ({ page }) => {
    await page.goto('/login');

    await page.locator('#login-email').fill('invalid-email');
    await page.locator('#login-password').fill('short');

    await expect(page.locator('#login-email-error')).toBeVisible();
    await expect(page.locator('#login-password-error')).toBeVisible();
    await expect(page.locator('form.auth-form button[type="submit"]')).toBeDisabled();
  });

  test('register nickname length validation shows error', async ({ page }) => {
    await page.goto('/login');
    await page.locator('.auth-toggle-button').click();

    const longNickname = 'a'.repeat(65);
    await page.locator('#register-nickname').fill(longNickname);
    await page.locator('#register-email').fill('tester@example.com');
    await page.locator('#register-password').fill('12345678');
    await page.locator('#register-confirm-password').fill('12345678');

    await expect(page.locator('#register-nickname-error')).toBeVisible();
    await expect(page.locator('form.auth-form button[type="submit"]')).toBeDisabled();
  });
});
