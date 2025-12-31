const DEFAULT_DEV_API_BASE_URL = 'http://localhost:8000';

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;
const LOCALHOST_PATTERN = /^https?:\/\/(localhost|127(?:\.\d{1,3}){3})(?::\d+)?$/i;
const API_BASE_URL_STORAGE_KEY = 'verbalize-yourself:api-base-url';
const API_BASE_URL_QUERY_KEY = 'apiBaseUrl';

const normalizeBaseUrl = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().replace(/\/$/, '');
  if (!trimmed) {
    return null;
  }

  return ABSOLUTE_URL_PATTERN.test(trimmed) ? trimmed : null;
};

const resolveRuntimeApiBaseUrl = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const override = normalizeBaseUrl(
      (window as typeof window & { __VERBALIZE_API_BASE_URL__?: unknown })
        .__VERBALIZE_API_BASE_URL__ as string | undefined,
    );
    if (override) {
      return override;
    }
  } catch {
    // Ignore unexpected window override access failures.
  }

  try {
    const params = new URLSearchParams(window.location?.search ?? '');
    const fromQuery = normalizeBaseUrl(params.get(API_BASE_URL_QUERY_KEY));
    if (fromQuery) {
      try {
        window.localStorage?.setItem(API_BASE_URL_STORAGE_KEY, fromQuery);
      } catch {
        // Best-effort persistence for the API override.
      }

      return fromQuery;
    }
  } catch {
    // Ignore query parsing errors.
  }

  try {
    const stored = normalizeBaseUrl(window.localStorage?.getItem(API_BASE_URL_STORAGE_KEY));
    if (stored) {
      return stored;
    }
  } catch {
    // Ignore storage access failures.
  }

  return null;
};

const resolveMetaApiBaseUrl = (): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  try {
    const element = document.querySelector('meta[name="verbalize:api-base-url"]');
    const content = normalizeBaseUrl(element?.getAttribute('content'));
    return content ?? null;
  } catch {
    return null;
  }
};

const resolveWindowApiBaseUrl = (): string | null => {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return null;
  }

  const origin = window.location.origin.replace(/\/$/, '');
  if (!origin || LOCALHOST_PATTERN.test(origin)) {
    return null;
  }

  return origin;
};

const resolveApiBaseUrl = (): string => {
  return (
    resolveRuntimeApiBaseUrl() ||
    resolveMetaApiBaseUrl() ||
    resolveWindowApiBaseUrl() ||
    DEFAULT_DEV_API_BASE_URL
  );
};

export const API_BASE_URL = resolveApiBaseUrl();

export const buildApiUrl = (path: string): string => {
  if (ABSOLUTE_URL_PATTERN.test(path)) {
    return path;
  }

  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
};

export const isApiRequestUrl = (url: string): boolean => {
  if (!url) {
    return false;
  }

  if (ABSOLUTE_URL_PATTERN.test(url)) {
    return url.startsWith(API_BASE_URL);
  }

  return true;
};
