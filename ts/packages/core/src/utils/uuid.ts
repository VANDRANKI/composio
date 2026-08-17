/**
 * Generate a random UUID (v4) using the platform's `crypto` implementation.
 * @returns A randomly generated UUID string, e.g. `"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"`.
 */
export function getRandomUUID(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Generate a short, random identifier derived from a UUID.
 * Useful for correlation IDs where a full UUID would be excessive.
 * @returns An 8-character hexadecimal string with hyphens removed, e.g. `"9b1deb4d"`.
 */
export function getRandomShortId(): string {
  return getRandomUUID().slice(0, 8).replace(/-/g, '');
}
