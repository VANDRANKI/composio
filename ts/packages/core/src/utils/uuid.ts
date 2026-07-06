/**
 * Generates a random RFC 4122 version 4 UUID using the platform's crypto API.
 */
export function getRandomUUID(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Generates a random short identifier by taking the first 8 characters of a
 * UUID and stripping hyphens. Useful for human-friendly, non-cryptographic IDs.
 */
export function getRandomShortId(): string {
  return getRandomUUID().slice(0, 8).replace(/-/g, '');
}
