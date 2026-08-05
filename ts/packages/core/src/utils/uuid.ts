/**
 * Generates a random RFC 4122 v4 UUID using the platform's Web Crypto API.
 */
export function getRandomUUID(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Generates a random 8-character hex-like identifier by truncating a UUID.
 * Useful for short, human-readable IDs where full UUID uniqueness isn't required.
 */
export function getRandomShortId(): string {
  return getRandomUUID().slice(0, 8).replace(/-/g, '');
}
