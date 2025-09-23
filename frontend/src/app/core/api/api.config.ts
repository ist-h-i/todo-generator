export const API_BASE_URL = 'http://localhost:8000';

export const buildApiUrl = (path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
};
