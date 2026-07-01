/**
 * Generates a random UUID v4 string using the platform's crypto implementation.
 */
export function getRandomUUID(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Generates a short, non-cryptographically-unique ID derived from a random UUID.
 *
 * Returns the first 8 hex characters of a UUID with dashes removed. Intended
 * for human-friendly identifiers (e.g. generated filenames), not for
 * collision-sensitive use cases.
 */
export function getRandomShortId(): string {
  return getRandomUUID().slice(0, 8).replace(/-/g, '');
}
