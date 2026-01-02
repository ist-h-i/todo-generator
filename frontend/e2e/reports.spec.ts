import { expect, test } from '@playwright/test';

import { setupWorkspaceMocks } from './support/workspace-mocks';
import { makeCardResponse } from './support/test-data';

const NOW = '2025-01-01T00:00:00Z';

const REPORT_BASE = {
  id: 'report-1',
  shift_type: null,
  tags: [],
  status: 'draft',
  auto_ticket_enabled: false,
  sections: [{ title: null, body: 'Updates this week' }],
  analysis_model: null,
  analysis_started_at: null,
  analysis_completed_at: null,
  failure_reason: null,
  confidence: null,
  created_at: NOW,
  updated_at: NOW,
};

const REPORT_DETAIL = {
  ...REPORT_BASE,
  status: 'completed',
  cards: [],
  events: [],
  processing_meta: { ai_warnings: ['Check inputs'] },
  pending_proposals: [
    {
      title: 'Improve onboarding docs',
      summary: 'Capture recent onboarding notes and streamline the checklist.',
      status: 'todo',
      labels: ['docs'],
      priority: 'high',
      due_in_days: 3,
      subtasks: [
        { title: 'Collect feedback', description: 'Interview new joiners', status: 'todo' },
      ],
    },
  ],
};

test.describe('Reports', () => {
  test('shows validation error when sections are empty', async ({ page }) => {
    await setupWorkspaceMocks(page);

    await page.goto('/reports');

    await page.locator('form.page-form').first().locator('button[type="submit"]').click();
    await expect(page.locator('.app-alert--error')).toBeVisible();
  });

  test('submits a report and publishes a proposal', async ({ page }) => {
    await setupWorkspaceMocks(page, {
      'POST /status-reports': { json: REPORT_BASE },
      'POST /status-reports/report-1/submit': { json: REPORT_DETAIL },
      'POST /cards': {
        json: makeCardResponse({ id: 'card-1', title: 'Improve onboarding docs' }),
      },
    });

    await page.goto('/reports');

    await page.locator('textarea[formControlName="body"]').fill('Weekly update notes');
    await page.locator('form.page-form').first().locator('button[type="submit"]').click();

    await expect(page.locator('.report-assistant-page__proposal-editor')).toHaveCount(1);

    await page
      .locator('.report-assistant-page__proposal-editor button.button--secondary')
      .click();

    await expect(
      page.locator('.app-alert--success', { hasText: 'Improve onboarding docs' }),
    ).toBeVisible();
  });

  test('shows publish error when card creation fails', async ({ page }) => {
    await setupWorkspaceMocks(page, {
      'POST /status-reports': { json: REPORT_BASE },
      'POST /status-reports/report-1/submit': { json: REPORT_DETAIL },
      'POST /cards': { status: 500, json: { detail: 'failed' } },
    });

    await page.goto('/reports');

    await page.locator('textarea[formControlName="body"]').fill('Weekly update notes');
    await page.locator('form.page-form').first().locator('button[type="submit"]').click();

    await expect(page.locator('.report-assistant-page__proposal-editor')).toHaveCount(1);

    await page
      .locator('.report-assistant-page__proposal-editor button.button--secondary')
      .click();

    await expect(page.locator('.app-alert--error')).toBeVisible();
  });

  test('shows api error when report submission fails', async ({ page }) => {
    await setupWorkspaceMocks(page, {
      'POST /status-reports': { status: 500, json: { detail: 'server error' } },
    });

    await page.goto('/reports');

    await page.locator('textarea[formControlName="body"]').fill('Weekly update notes');
    await page.locator('form.page-form').first().locator('button[type="submit"]').click();

    await expect(page.locator('.app-alert--error')).toBeVisible();
  });
});
