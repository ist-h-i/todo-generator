const DEFAULT_DEV_API_BASE_URL = 'http://localhost:8000';

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;
const LOCALHOST_PATTERN = /^https?:\/\/(localhost|127(?:\.\d{1,3}){3})(?::\d+)?$/i;

const resolveMetaApiBaseUrl = (): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  try {
    const element = document.querySelector('meta[name="verbalize:api-base-url"]');
    const content = element?.getAttribute('content')?.trim();
    return content?.length ? content.replace(/\/$/, '') : null;
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
  return resolveMetaApiBaseUrl() || resolveWindowApiBaseUrl() || DEFAULT_DEV_API_BASE_URL;
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
