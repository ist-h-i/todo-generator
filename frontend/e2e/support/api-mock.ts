import type { Page } from '@playwright/test';

export const API_ORIGIN = 'http://localhost:8000';
const API_BASE_URL_STORAGE_KEY = 'verbalize-yourself:api-base-url';

const ensureApiBaseUrl = async (page: Page): Promise<void> => {
  await page.addInitScript(
    ({ storageKey, apiOrigin }) => {
      if (!window.localStorage.getItem(storageKey)) {
        window.localStorage.setItem(storageKey, apiOrigin);
      }
    },
    { storageKey: API_BASE_URL_STORAGE_KEY, apiOrigin: API_ORIGIN },
  );
};

type MockRequest = {
  readonly method: string;
  readonly path: string;
  readonly url: URL;
  readonly rawUrl: string;
  readonly postData: string | null;
};

export type MockResponse = {
  readonly status?: number;
  readonly json?: unknown;
  readonly body?: string;
  readonly contentType?: string;
  readonly headers?: Record<string, string>;
  readonly delayMs?: number;
};

type MockHandler = (request: MockRequest) => MockResponse | Promise<MockResponse>;

export type ApiMockMap = Record<string, MockResponse | MockHandler>;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

const normalizeKey = (method: string, path: string): string => `${method.toUpperCase()} ${path}`;

const sleep = async (delayMs: number): Promise<void> => {
  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
};

export const mockApi = async (
  page: Page,
  mocks: ApiMockMap,
  options?: { readonly strict?: boolean },
): Promise<void> => {
  await ensureApiBaseUrl(page);
  const strict = options?.strict ?? true;

  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { ...CORS_HEADERS } });
      return;
    }

    const rawUrl = request.url();
    const url = new URL(rawUrl);
    const key = normalizeKey(method, url.pathname);
    const handler = mocks[key];

    if (!handler) {
      const status = strict ? 501 : 404;
      await route.fulfill({
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detail: `Missing API mock for ${key}`,
        }),
      });
      return;
    }

    const response =
      typeof handler === 'function'
        ? await handler({
            method,
            path: url.pathname,
            url,
            rawUrl,
            postData: request.postData(),
          })
        : handler;

    if (response.delayMs) {
      await sleep(response.delayMs);
    }

    const status = response.status ?? 200;
    const headers = { ...CORS_HEADERS, ...(response.headers ?? {}) };

    if (response.json !== undefined) {
      await route.fulfill({
        status,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(response.json),
      });
      return;
    }

    await route.fulfill({
      status,
      headers: { ...headers, 'Content-Type': response.contentType ?? 'text/plain' },
      body: response.body ?? '',
    });
  });
};
