import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { setupWorkspaceMocks } from './support/workspace-mocks';

const CONFIG_WITH_LABELS = {
  labels: [
    {
      id: 'label-1',
      name: 'Launch',
      color: '#ff0000',
      description: 'Release milestones',
      achievements: [
        { id: 'ach-1', title: 'Shipped v1', summary: 'Delivered the first release' },
      ],
    },
  ],
  recommended_flow: ['Discovery', 'Delivery'],
  formats: [
    {
      id: 'markdown',
      name: 'Markdown',
      description: 'Full narrative format',
      editor_mode: 'markdown',
    },
    {
      id: 'bullet_list',
      name: 'Bullet list',
      description: 'Concise bullet format',
      editor_mode: 'markdown',
    },
  ],
};

const GENERATION_PARTIAL = {
  generation_id: 'gen-1',
  subject_echo: 'Launch',
  flow: ['Discovery', 'Delivery'],
  warnings: ['Minor formatting issue'],
  formats: {
    markdown: { content: '# Launch summary\n\nHighlights', tokens_used: 120 },
    bullet_list: { content: '- Highlight A\n- Highlight B', tokens_used: 40 },
  },
  generation_status: 'partial',
  ai_failure_reason: 'timeout',
};

const waitForConfig = (page: Page, status?: number): Promise<unknown> => {
  return page.waitForResponse((response) => {
    if (!response.url().includes('/appeals/config')) {
      return false;
    }
    return typeof status === 'number' ? response.status() === status : true;
  });
};

const waitForGenerate = (page: Page, status?: number): Promise<unknown> => {
  return page.waitForResponse((response) => {
    if (!response.url().includes('/appeals/generate')) {
      return false;
    }
    return typeof status === 'number' ? response.status() === status : true;
  });
};

const gotoAchievementOutput = async (page: Page): Promise<void> => {
  await Promise.all([waitForConfig(page, 200), page.goto('/achievement-output')]);
  await expect(page.locator('.achievement-output-page__composer')).toBeVisible();
};

test.describe('Achievement Output', () => {
  test('shows config error and reloads', async ({ page }) => {
    let shouldFail = true;

    await setupWorkspaceMocks(page, {
      'GET /appeals/config': () => {
        if (shouldFail) {
          return { status: 500, json: { detail: 'fail' } };
        }
        return { json: CONFIG_WITH_LABELS };
      },
    });

    await Promise.all([waitForConfig(page, 500), page.goto('/achievement-output')]);

    const errorState = page.locator('.page-state--error');
    await expect(errorState).toBeVisible();

    shouldFail = false;
    await Promise.all([waitForConfig(page, 200), errorState.locator('button').click()]);
    await expect(page.locator('.achievement-output-page__composer')).toBeVisible();
  });

  test('validates subject, flow, and format selections', async ({ page }) => {
    await setupWorkspaceMocks(page, {
      'GET /appeals/config': { json: CONFIG_WITH_LABELS },
    });

    await gotoAchievementOutput(page);

    const submitButton = page.locator('.achievement-output-page__actions button[type="submit"]');
    await expect(submitButton).toBeEnabled();

    await page.locator('.achievement-output-page__subject-option').nth(1).click();
    await expect(submitButton).toBeDisabled();

    await page
      .locator('.achievement-output-page__group')
      .first()
      .locator('input.form-control')
      .fill('Onboarding');
    await expect(submitButton).toBeEnabled();

    const flowInputs = page.locator('.achievement-output-page__flow-list input.form-control');
    for (let i = 0; i < (await flowInputs.count()); i += 1) {
      await flowInputs.nth(i).fill('');
    }
    await expect(submitButton).toBeDisabled();

    await flowInputs.first().fill('Discovery');
    await expect(submitButton).toBeEnabled();

    const formatOptions = page.locator('.achievement-output-page__format-option');
    for (let i = 0; i < (await formatOptions.count()); i += 1) {
      await formatOptions.nth(i).click();
    }

    await expect(submitButton).toBeDisabled();
    await formatOptions.first().click();
    await expect(submitButton).toBeEnabled();
  });

  test('handles daily limit responses from the API', async ({ page }) => {
    await setupWorkspaceMocks(page, {
      'GET /appeals/config': { json: CONFIG_WITH_LABELS },
      'POST /appeals/generate': { status: 429, json: { detail: 'limit' } },
    });

    await gotoAchievementOutput(page);

    await Promise.all([
      waitForGenerate(page, 429),
      page.locator('.achievement-output-page__actions button[type="submit"]').click(),
    ]);
    await expect(page.locator('.app-alert--error')).toBeVisible();
  });

  test('renders partial generation output and switches formats', async ({ page }) => {
    await setupWorkspaceMocks(page, {
      'GET /appeals/config': { json: CONFIG_WITH_LABELS },
      'POST /appeals/generate': { json: GENERATION_PARTIAL },
    });

    await gotoAchievementOutput(page);

    await Promise.all([
      waitForGenerate(page, 200),
      page.locator('.achievement-output-page__actions button[type="submit"]').click(),
    ]);
    await expect(page.locator('.achievement-output-page__generation-badge')).toBeVisible();
    await expect(page.locator('.achievement-output-page__output-text')).toHaveValue(
      '# Launch summary\n\nHighlights',
    );

    await page.locator('.achievement-output-page__tabs .page-tab').nth(1).click();
    await expect(page.locator('.achievement-output-page__output-text')).toHaveValue(
      '- Highlight A\n- Highlight B',
    );
  });
});
