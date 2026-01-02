import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import type { ApiMockMap } from './support/api-mock';
import { mockApi } from './support/api-mock';
import { setLocalStorage } from './support/storage';
import { AUTH_TOKEN_STORAGE_KEY, TEST_TOKEN, TEST_USER } from './support/test-data';

const NOW = '2025-01-01T00:00:00Z';

const BASE_LEVELS = [
  {
    id: 'level-junior',
    value: 'junior',
    label: 'Junior',
    scale: 3,
    description: null,
    sort_order: 0,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'level-senior',
    value: 'senior',
    label: 'Senior',
    scale: 5,
    description: null,
    sort_order: 1,
    created_at: NOW,
    updated_at: NOW,
  },
];

const BASE_QUOTAS = {
  card_daily_limit: 5,
  evaluation_daily_limit: 2,
  analysis_daily_limit: 3,
  status_report_daily_limit: 2,
  immunity_map_daily_limit: 2,
  immunity_map_candidate_daily_limit: 2,
  appeal_daily_limit: 1,
  auto_card_daily_limit: 1,
};

const buildCompetency = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'comp-1',
  name: 'Quality',
  level: 'junior',
  description: 'Baseline quality checks',
  rubric: {},
  sort_order: 0,
  is_active: true,
  criteria: [
    {
      id: 'criterion-1',
      title: 'Consistency',
      description: 'Shows consistent delivery',
      weight: null,
      intentionality_prompt: null,
      behavior_prompt: null,
      is_active: true,
      order_index: 0,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

const buildEvaluation = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'eval-1',
  competency_id: 'comp-1',
  user_id: 'user-2',
  period_start: NOW,
  period_end: NOW,
  scale: 3,
  score_value: 2,
  score_label: 'Meets',
  rationale: 'Steady results',
  attitude_actions: [],
  behavior_actions: [],
  triggered_by: 'manual',
  created_at: NOW,
  updated_at: NOW,
  competency: { id: 'comp-1', name: 'Quality', level: 'junior' },
  items: [],
  ...overrides,
});

const buildAdminUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'user-1',
  email: 'tester@example.com',
  is_admin: true,
  is_active: true,
  card_daily_limit: null,
  evaluation_daily_limit: null,
  analysis_daily_limit: null,
  status_report_daily_limit: null,
  immunity_map_daily_limit: null,
  immunity_map_candidate_daily_limit: null,
  appeal_daily_limit: null,
  auto_card_daily_limit: null,
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

const setupAdminSession = async (page: Page, overrides: ApiMockMap = {}): Promise<void> => {
  await setLocalStorage(page, { [AUTH_TOKEN_STORAGE_KEY]: TEST_TOKEN });

  await mockApi(page, {
    'GET /auth/me': { json: { ...TEST_USER, is_admin: true } },
    'GET /admin/competencies': { json: [] },
    'GET /admin/competency-levels': { json: BASE_LEVELS },
    'GET /admin/users': { json: [buildAdminUser()] },
    'GET /admin/evaluations': { json: [] },
    'GET /admin/quotas/defaults': { json: BASE_QUOTAS },
    'GET /admin/api-credentials/gemini': {
      status: 404,
      json: { detail: 'missing' },
    },
    'GET /admin/api-credentials/gemini/models': { json: ['models/gemini-2.5-flash'] },
    ...overrides,
  });
};

test.describe('Admin', () => {
  test('shows empty state and validation errors', async ({ page }) => {
    await setupAdminSession(page, {
      'GET /admin/competency-levels': { status: 404, json: { detail: 'missing' } },
    });

    await page.goto('/admin');

    await page
      .locator('shared-ui-select[name="competency-level"] .ui-select__trigger')
      .click();
    await expect(
      page.locator('shared-ui-select[name="competency-level"] .ui-select__option'),
    ).toHaveCount(2);
    await page.keyboard.press('Escape');

    await expect(page.locator('.page-empty').first()).toBeVisible();

    const competencyForm = page.locator('form.page-form').first();
    await competencyForm.locator('button[type="submit"]').click();
    await expect(page.locator('.app-alert--error')).toBeVisible();

    const errorAlert = page.locator('.app-alert--error');
    if ((await errorAlert.count()) > 0) {
      await errorAlert.locator('button').click();
    }

    await page.locator('.page-tab').nth(1).click();
    await page.locator('form.page-form').first().locator('button[type="submit"]').click();
    await expect(page.locator('.app-alert--error')).toBeVisible();
  });

  test('creates, edits, toggles, and deletes a competency', async ({ page }) => {
    let competencies = [buildCompetency()];

    const updateCompetency = (
      id: string,
      payload: Record<string, unknown>,
    ): Record<string, unknown> => {
      const updated = competencies.map((item) =>
        item.id === id
          ? {
              ...item,
              name: payload.name ?? item.name,
              level: payload.level ?? item.level,
              description:
                typeof payload.description === 'string' ? payload.description : item.description,
              is_active:
                typeof payload.is_active === 'boolean' ? payload.is_active : item.is_active,
              criteria: Array.isArray(payload.criteria) ? payload.criteria : item.criteria,
              updated_at: NOW,
            }
          : item,
      );
      competencies = updated;
      return competencies.find((item) => item.id === id) ?? buildCompetency({ id });
    };

    await setupAdminSession(page, {
      'GET /admin/competencies': () => ({ json: competencies }),
      'POST /admin/competencies': ({ postData }) => {
        const payload = postData ? (JSON.parse(postData) as Record<string, unknown>) : {};
        const next = buildCompetency({
          id: 'comp-2',
          name: payload.name ?? 'Ownership',
          level: payload.level ?? 'junior',
          description: payload.description ?? null,
          criteria:
            Array.isArray(payload.criteria) && payload.criteria.length > 0
              ? payload.criteria
              : buildCompetency().criteria,
        });
        competencies = [...competencies, next];
        return { json: next };
      },
      'PATCH /admin/competencies/comp-2': ({ postData }) => {
        const payload = postData ? (JSON.parse(postData) as Record<string, unknown>) : {};
        return { json: updateCompetency('comp-2', payload) };
      },
      'DELETE /admin/competencies/comp-2': () => {
        competencies = competencies.filter((item) => item.id !== 'comp-2');
        return { status: 204 };
      },
    });

    await page.goto('/admin');

    await page.locator('input[name="competency-name"]').fill('Ownership');
    await page.locator('textarea[name="competency-description"]').fill('Owns outcomes');
    await page.locator('input[name="criterion-0-title"]').fill('Initiative');
    await page.locator('form.page-form').first().locator('button[type="submit"]').click();

    const newItem = page.locator('.page-list__item', { hasText: 'Ownership' });
    await expect(newItem.locator('.page-list__title')).toBeVisible();

    const activeToggle = newItem.locator('input[type="checkbox"]');
    await activeToggle.click();
    await expect(activeToggle).not.toBeChecked();

    await newItem.locator('button.button--secondary').click();
    await page.locator('input[name="competency-name"]').fill('Ownership updated');
    await page.locator('form.page-form').first().locator('button[type="submit"]').click();

    await expect(page.locator('.page-list__title', { hasText: 'Ownership updated' })).toBeVisible();

    const deleteButton = page
      .locator('.page-list__item', { hasText: 'Ownership updated' })
      .locator('button.button--danger');
    page.once('dialog', async (dialog) => dialog.accept());
    await deleteButton.click();

    await expect(page.locator('.page-list__title', { hasText: 'Ownership updated' })).toHaveCount(0);
  });

  test('triggers evaluations and manages users', async ({ page }) => {
    let users = [
      buildAdminUser({ id: 'user-1', email: 'tester@example.com', is_admin: true }),
      buildAdminUser({ id: 'user-2', email: 'member@example.com', is_admin: false }),
    ];

    await setupAdminSession(page, {
      'GET /admin/competencies': { json: [buildCompetency()] },
      'GET /admin/users': () => ({ json: users }),
      'POST /admin/competencies/comp-1/evaluate': () => ({ json: buildEvaluation() }),
      'DELETE /admin/users/user-2': () => {
        users = users.filter((user) => user.id !== 'user-2');
        return { status: 204 };
      },
    });

    await page.goto('/admin');

    await page.locator('.page-tab').nth(1).click();
    await page.locator('form.page-form').first().locator('button[type="submit"]').click();
    await expect(page.locator('.app-alert--error')).toBeVisible();

    const errorAlert = page.locator('.app-alert--error');
    if ((await errorAlert.count()) > 0) {
      await errorAlert.locator('button').click();
    }

    const userSelect = page.locator('shared-ui-select[name="evaluation-user"]');
    await userSelect.locator('.ui-select__trigger').click();
    await userSelect.locator('.ui-select__option', { hasText: 'member@example.com' }).click();

    const competencyOption = page.locator('.admin-manual__competency-option', {
      hasText: 'Quality',
    });
    await expect(competencyOption).toBeVisible();
    await competencyOption.locator('input[type="checkbox"]').check();

    await page.locator('form.page-form').first().locator('button[type="submit"]').click();
    await expect(page.locator('.admin-evaluations__item')).toHaveCount(1);

    await page.locator('.page-tab').nth(2).click();

    const deleteCurrent = page
      .locator('tr', { hasText: 'tester@example.com' })
      .locator('button.button--danger');
    await expect(deleteCurrent).toBeDisabled();

    const deleteOther = page
      .locator('tr', { hasText: 'member@example.com' })
      .locator('button.button--danger');
    page.once('dialog', async (dialog) => dialog.accept());
    await deleteOther.click();

    await expect(page.locator('tr', { hasText: 'member@example.com' })).toHaveCount(0);
  });

  test('updates api credential and quota defaults', async ({ page }) => {
    await setupAdminSession(page, {
      'PUT /admin/api-credentials/gemini': {
        json: {
          provider: 'gemini',
          secret_hint: 'AIza...',
          is_active: true,
          model: 'models/gemini-2.5-flash',
          created_at: NOW,
          updated_at: NOW,
        },
      },
      'PUT /admin/quotas/defaults': ({ postData }) => {
        const payload = postData ? JSON.parse(postData) : BASE_QUOTAS;
        return { json: payload };
      },
    });

    await page.goto('/admin');
    await page.locator('.page-tab').nth(3).click();

    await page.locator('form.page-form').first().locator('button[type="submit"]').click();
    await expect(page.locator('.app-alert--error')).toBeVisible();

    const errorAlert = page.locator('.app-alert--error');
    if ((await errorAlert.count()) > 0) {
      await errorAlert.locator('button').click();
    }

    await page.locator('input[name="api-secret"]').fill('AIza-test');
    await page.locator('form.page-form').first().locator('button[type="submit"]').click();
    await expect(page.locator('.app-alert--success')).toBeVisible();

    await page.locator('input[name="default-card-limit"]').fill('');
    await page
      .locator('form.page-form')
      .nth(1)
      .locator('button[type="submit"]')
      .click();
    await expect(page.locator('.app-alert--error')).toBeVisible();

    const errorAlertAfterQuota = page.locator('.app-alert--error');
    if ((await errorAlertAfterQuota.count()) > 0) {
      await errorAlertAfterQuota.locator('button').click();
    }

    await page.locator('input[name="default-card-limit"]').fill('8');
    await page
      .locator('form.page-form')
      .nth(1)
      .locator('button[type="submit"]')
      .click();
    await expect(page.locator('.app-alert--success')).toBeVisible();
  });
});
