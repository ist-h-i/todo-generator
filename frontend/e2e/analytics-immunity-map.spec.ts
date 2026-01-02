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

const buildNestedCandidateResponse = (): Record<string, unknown> => ({
  context_summary: 'Context sources (last 28 days): profile, cards=1',
  used_sources: { status_reports: 0, cards: 1, snapshots: 0 },
  data: {
    cards: [
      {
        id: 'candidate-card-1',
        title: 'Redmine operations standardization',
        summary: 'Standardize Redmine operations across the project.',
        ai_confidence: 0,
      },
    ],
  },
});

const buildArrayCandidateResponse = (): Record<string, unknown>[] => [
  {
    id: 'candidate-card-2',
    title: 'Redmine operations standardization (array)',
    summary: 'Standardize Redmine operations across the project.',
    ai_notes: 'Candidate from array payload.',
    ai_confidence: 0,
  },
];

const setupAnalyticsSession = async (
  page: Page,
  candidateResponse: unknown = buildNestedCandidateResponse(),
  overrides: ApiMockMap = {},
): Promise<void> => {
  await setLocalStorage(page, { [AUTH_TOKEN_STORAGE_KEY]: TEST_TOKEN });

  await mockApi(page, {
    'GET /auth/me': { json: TEST_USER },
    'GET /board-layouts': { json: BOARD_LAYOUT },
    'GET /statuses': { json: BOARD_STATUSES },
    'GET /labels': { json: BOARD_LABELS },
    'GET /workspace/templates': { json: BOARD_TEMPLATES },
    'GET /cards': {
      json: [
        makeCardResponse({
          id: 'card-1',
          title: 'Seed card',
          summary: 'Seed summary',
          status_id: 'done',
        }),
      ],
    },
    'POST /analysis/immunity-map/candidates': { json: candidateResponse },
    ...overrides,
  });
};

test.describe('Analytics', () => {
  test('shows immunity map candidate cards from nested card payload', async ({ page }) => {
    await setupAnalyticsSession(page);

    await page.goto('/analytics');

    await page.locator('.analytics-immunity-map__composer button.button--secondary').click();

    const candidates = page.locator('.analytics-immunity-map__candidate');
    await expect(candidates).toHaveCount(1);
    const candidateInput = candidates.first().locator('input.form-control');
    await expect(candidateInput).toHaveValue(/Redmine/i);
  });

  test('shows immunity map candidate cards from array payload', async ({ page }) => {
    await setupAnalyticsSession(page, buildArrayCandidateResponse());

    await page.goto('/analytics');

    await page.locator('.analytics-immunity-map__composer button.button--secondary').click();

    const candidates = page.locator('.analytics-immunity-map__candidate');
    await expect(candidates).toHaveCount(1);
    const candidateInput = candidates.first().locator('input.form-control');
    await expect(candidateInput).toHaveValue(/array/i);
  });

  test('shows candidate fetch error state', async ({ page }) => {
    await setupAnalyticsSession(page, buildNestedCandidateResponse(), {
      'POST /analysis/immunity-map/candidates': { status: 500, json: { detail: 'failed' } },
    });

    await page.goto('/analytics');

    await page.locator('.analytics-immunity-map__composer button.button--secondary').click();
    const errorAlert = page.locator('.analytics-immunity-map__composer .app-alert--error');
    const globalError = page.locator('.hover-message[data-severity="error"]');
    await expect(errorAlert.or(globalError)).toBeVisible();
  });

  test('shows empty candidate state after refresh', async ({ page }) => {
    await setupAnalyticsSession(page, {
      candidates: [],
      used_sources: { status_reports: 0, cards: 0, snapshots: 0 },
    });

    await page.goto('/analytics');

    await page.locator('.analytics-immunity-map__composer button.button--secondary').click();

    await expect(page.locator('.analytics-immunity-map__composer .page-state')).toBeVisible();
    await expect(page.locator('.analytics-immunity-map__candidate')).toHaveCount(0);
  });

  test('shows generation error when no candidates are selected', async ({ page }) => {
    await setupAnalyticsSession(page, buildNestedCandidateResponse());

    await page.goto('/analytics');

    await page.locator('.analytics-immunity-map__composer button.button--secondary').click();

    await expect(page.locator('.analytics-immunity-map__candidate')).toHaveCount(1);
    const toggleButton = page.locator('.analytics-immunity-map__candidate button.button--pill');
    await toggleButton.click();

    await page.locator('.analytics-immunity-map__composer button.button--primary').click();
    await expect(page.locator('.analytics-immunity-map__composer .app-alert--error')).toBeVisible();
  });

  test('generates immunity map from manual inputs', async ({ page }) => {
    await setupAnalyticsSession(page, buildNestedCandidateResponse(), {
      'POST /analysis/immunity-map': {
        json: {
          model: 'test-model',
          payload: {
            nodes: [{ id: 'A1', group: 'A', label: 'Root', kind: 'should' }],
            edges: [],
          },
          mermaid: 'graph TD; A1[Root];',
          summary: {
            current_analysis: 'Current state',
            one_line_advice: 'Next step',
          },
          core_insight: { text: 'Key insight', related_node_id: 'A1' },
          readout_cards: [],
          warnings: [],
        },
      },
    });

    await page.goto('/analytics');

    await page.locator('.analytics-immunity-map__composer button.button--pill').first().click();

    const manualInputs = page.locator('.analytics-immunity-map__composer textarea.form-control--textarea');
    await manualInputs.first().fill('Keep focus on onboarding');

    await page.locator('.analytics-immunity-map__composer button.button--primary').click();
    await expect(page.locator('.analytics-immunity-map__viewer')).toBeVisible();
  });
});
