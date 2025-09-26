/**
 * Generates a short unique identifier suitable for mock entities.
 */
const FALLBACK_TEMPLATE = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

const supportsRandomUUID = (): boolean => {
  const cryptoRef: Crypto | undefined = globalThis.crypto;

  return typeof cryptoRef?.randomUUID === 'function';
};

const fallbackRandomUUID = (): string =>
  FALLBACK_TEMPLATE.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;

    return Math.floor(value).toString(16);
  });

export const createId = (): string => {
  if (supportsRandomUUID()) {
    return globalThis.crypto!.randomUUID();
  }

  return fallbackRandomUUID();
};
