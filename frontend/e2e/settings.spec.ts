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
} from './support/test-data';

const setupSettingsSession = async (page: Page, overrides: ApiMockMap = {}): Promise<void> => {
  await setLocalStorage(page, { [AUTH_TOKEN_STORAGE_KEY]: TEST_TOKEN });

  let labels = [...BOARD_LABELS];
  let statuses = [...BOARD_STATUSES];
  let templates = [...BOARD_TEMPLATES];

  await mockApi(page, {
    'GET /auth/me': { json: TEST_USER },
    'GET /statuses': () => ({ json: statuses }),
    'GET /labels': () => ({ json: labels }),
    'GET /workspace/templates': () => ({ json: templates }),
    'GET /board-layouts': { json: BOARD_LAYOUT },
    'GET /cards': { json: [] },
    'POST /statuses': ({ postData }) => {
      const payload = postData
        ? (JSON.parse(postData) as { name?: string; category?: string; color?: string })
        : {};
      const next = {
        id: `status-${statuses.length + 1}`,
        name: payload.name ?? 'Untitled',
        category: payload.category ?? 'todo',
        order: statuses.length,
        color: payload.color ?? '#000000',
      };
      statuses = [...statuses, next];
      return { json: next };
    },
    'DELETE /statuses/status-1': () => {
      statuses = statuses.filter((status) => status.id !== 'status-1');
      return { status: 204 };
    },
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
    'DELETE /labels/bug': () => {
      labels = labels.filter((label) => label.id !== 'bug');
      return { status: 204 };
    },
    'POST /workspace/templates': ({ postData }) => {
      const payload = postData
        ? (JSON.parse(postData) as {
            name?: string;
            description?: string;
            default_status_id?: string;
            default_label_ids?: string[];
            confidence_threshold?: number;
            field_visibility?: Record<string, boolean>;
          })
        : {};
      const next = {
        id: `template-${templates.length + 1}`,
        owner_id: 'user-1',
        name: payload.name ?? 'Untitled',
        description: payload.description ?? null,
        default_status_id: payload.default_status_id ?? 'todo',
        default_label_ids: payload.default_label_ids ?? [],
        confidence_threshold: payload.confidence_threshold ?? 60,
        field_visibility: payload.field_visibility ?? {
          show_story_points: true,
          show_due_date: false,
          show_assignee: true,
          show_confidence: true,
        },
        is_system_default: false,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };
      templates = [...templates, next];
      return { json: next };
    },
    'PATCH /workspace/templates/template-1': ({ postData }) => {
      const payload = postData ? (JSON.parse(postData) as Record<string, unknown>) : {};
      templates = templates.map((template) =>
        template.id === 'template-1'
          ? {
              ...template,
              name: payload.name ?? template.name,
              description:
                typeof payload.description === 'string' ? payload.description : template.description,
              default_status_id:
                typeof payload.default_status_id === 'string'
                  ? payload.default_status_id
                  : template.default_status_id,
              default_label_ids: Array.isArray(payload.default_label_ids)
                ? payload.default_label_ids
                : template.default_label_ids,
              confidence_threshold:
                typeof payload.confidence_threshold === 'number'
                  ? payload.confidence_threshold
                  : template.confidence_threshold,
            }
          : template,
      );
      return { json: templates.find((template) => template.id === 'template-1') ?? templates[0] };
    },
    'DELETE /workspace/templates/template-1': () => {
      templates = templates.filter((template) => template.id !== 'template-1');
      return { status: 204 };
    },
    ...overrides,
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

  test('adds a status, creates a template, edits it, and removes a label', async ({ page }) => {
    await setupSettingsSession(page);

    await page.goto('/settings');

    const statusForm = page.locator('form.settings-form').nth(0);
    await statusForm.locator('#status-name').fill('Review');
    await statusForm.getByRole('button', { name: 'DOING' }).click();
    await statusForm.locator('#status-color').fill('#22c55e');
    await statusForm.locator('button[type="submit"]').click();

    await expect(
      page.locator('.settings-status-list .page-list__title', { hasText: 'Review' }),
    ).toBeVisible();

    const templateForm = page.locator('form.settings-form').nth(2);
    await templateForm.locator('#template-name').fill('Sprint boost');
    await templateForm.locator('#template-description').fill('Fast track changes');

    const statusSelect = templateForm.locator('shared-ui-select#template-status');
    await statusSelect.locator('.ui-select__trigger').click();
    await statusSelect.locator('.ui-select__option', { hasText: 'In Progress' }).click();

    await templateForm
      .locator('.settings-checkbox', { hasText: 'Bug' })
      .locator('input[type="checkbox"]')
      .check();

    await templateForm.locator('button[type="submit"]').click();

    const templateItem = page.locator('.settings-template', { hasText: 'Sprint boost' });
    await expect(templateItem.locator('.settings-template__title')).toBeVisible();

    await templateItem.locator('.settings-template__actions button').first().click();
    await templateItem.locator('input[id^="template-edit-name-"]').fill('Sprint boost updated');
    await templateItem.locator('form.settings-template__editor button[type="submit"]').click();

    await expect(
      page.locator('.settings-template__title', { hasText: 'Sprint boost updated' }),
    ).toBeVisible();

    const labelItem = page.locator('.settings-label', { hasText: 'Bug' });
    await labelItem.locator('button.button--ghost').click();
    await expect(page.locator('.settings-label-list .page-list__title', { hasText: 'Bug' })).toHaveCount(0);
  });
});
