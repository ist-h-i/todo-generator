import type { Page } from '@playwright/test';

import { API_ORIGIN } from './api-mock';

const API_BASE_URL_STORAGE_KEY = 'verbalize-yourself:api-base-url';
const DEFAULT_LOCAL_STORAGE_ENTRIES: Record<string, string> = {
  [API_BASE_URL_STORAGE_KEY]: API_ORIGIN,
};

export const setLocalStorage = async (page: Page, entries: Record<string, string>): Promise<void> => {
  const mergedEntries = { ...DEFAULT_LOCAL_STORAGE_ENTRIES, ...entries };
  await page.addInitScript((nextEntries) => {
    for (const [key, value] of Object.entries(nextEntries)) {
      window.localStorage.setItem(key, value);
    }
  }, mergedEntries);
};

export const removeLocalStorage = async (page: Page, keys: readonly string[]): Promise<void> => {
  await page.addInitScript((nextKeys) => {
    nextKeys.forEach((key) => window.localStorage.removeItem(key));
  }, keys);
};
