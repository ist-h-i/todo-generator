import type { Page } from '@playwright/test';

export const setLocalStorage = async (page: Page, entries: Record<string, string>): Promise<void> => {
  await page.addInitScript((nextEntries) => {
    for (const [key, value] of Object.entries(nextEntries)) {
      window.localStorage.setItem(key, value);
    }
  }, entries);
};

export const removeLocalStorage = async (page: Page, keys: readonly string[]): Promise<void> => {
  await page.addInitScript((nextKeys) => {
    nextKeys.forEach((key) => window.localStorage.removeItem(key));
  }, keys);
};

