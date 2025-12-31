import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { setLocalStorage } from './support/storage';
import { AUTH_TOKEN_STORAGE_KEY, TEST_NOW, TEST_TOKEN, TEST_USER } from './support/test-data';

const setupProfileSession = async (
  page: Page,
  overrides?: { readonly putStatus?: number },
): Promise<void> => {
  await setLocalStorage(page, { [AUTH_TOKEN_STORAGE_KEY]: TEST_TOKEN });

  const updatedUser = { ...TEST_USER, nickname: '新しい名前', updated_at: TEST_NOW };

  await mockApi(page, {
    'GET /auth/me': { json: TEST_USER },
    'GET /profile/me': { json: TEST_USER },
    'PUT /profile/me': {
      status: overrides?.putStatus ?? 200,
      json: overrides?.putStatus && overrides.putStatus >= 400 ? { detail: 'failed' } : updatedUser,
    },
  });
};

test.describe('Profile dialog', () => {
  test('loads profile and saves updates', async ({ page }) => {
    await setupProfileSession(page);

    await page.goto('/some-unknown-route');
    await page.getByRole('button', { name: 'プロフィール設定を開く' }).click();

    const dialog = page.getByRole('dialog', { name: 'プロフィールを編集' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#profile-nickname')).toHaveValue('テストユーザー');

    await dialog.locator('#profile-nickname').fill('新しい名前');
    await dialog.getByRole('button', { name: '保存する' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.shell-user__name')).toHaveText('新しい名前');
  });

  test('shows validation errors when nickname is empty', async ({ page }) => {
    await setupProfileSession(page);

    await page.goto('/some-unknown-route');
    await page.getByRole('button', { name: 'プロフィール設定を開く' }).click();

    const dialog = page.getByRole('dialog', { name: 'プロフィールを編集' });
    await expect(dialog).toBeVisible();

    await dialog.locator('#profile-nickname').fill('');
    await expect(dialog.getByRole('button', { name: '保存する' })).toBeDisabled();

    await dialog.locator('form.profile-dialog__form').dispatchEvent('submit');

    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog.locator('#profile-nickname')).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.locator('#profile-nickname-error')).toBeVisible();
  });

  test('cancel with dirty form asks confirmation and stays open when dismissed', async ({
    page,
  }) => {
    await setupProfileSession(page);

    await page.goto('/some-unknown-route');
    await page.getByRole('button', { name: 'プロフィール設定を開く' }).click();

    const dialog = page.getByRole('dialog', { name: 'プロフィールを編集' });
    await expect(dialog).toBeVisible();

    await dialog.locator('#profile-nickname').fill('変更あり');

    page.once('dialog', async (dialogEvent) => {
      expect(dialogEvent.message()).toContain('保存されていない変更があります');
      await dialogEvent.dismiss();
    });

    await dialog.getByRole('button', { name: 'キャンセル' }).click();
    await expect(dialog).toBeVisible();
  });

  test('invalid avatar file type shows alert', async ({ page }) => {
    await setupProfileSession(page);

    await page.goto('/some-unknown-route');
    await page.getByRole('button', { name: 'プロフィール設定を開く' }).click();

    const dialog = page.getByRole('dialog', { name: 'プロフィールを編集' });
    await expect(dialog).toBeVisible();

    const fileInput = dialog.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'avatar.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });

    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog.getByRole('alert')).toContainText('PNG');
  });

  test('oversized avatar file shows alert', async ({ page }) => {
    await setupProfileSession(page);

    await page.goto('/some-unknown-route');
    await page.getByRole('button', { name: 'プロフィール設定を開く' }).click();

    const dialog = page.getByRole('dialog', { name: 'プロフィールを編集' });
    await expect(dialog).toBeVisible();

    const fileInput = dialog.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'big-avatar.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    });

    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog.getByRole('alert')).toContainText('5MB');
  });

  test('server error on save shows alert and keeps dialog open', async ({ page }) => {
    await setupProfileSession(page, { putStatus: 500 });

    await page.goto('/some-unknown-route');
    await page.getByRole('button', { name: 'プロフィール設定を開く' }).click();

    const dialog = page.getByRole('dialog', { name: 'プロフィールを編集' });
    await expect(dialog).toBeVisible();

    await dialog.locator('#profile-nickname').fill('新しい名前');
    await dialog.getByRole('button', { name: '保存する' }).click();

    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog.getByRole('alert')).toContainText('プロフィールの更新に失敗しました');
    await expect(dialog).toBeVisible();
  });
});
