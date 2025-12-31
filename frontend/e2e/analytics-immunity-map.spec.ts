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
});

