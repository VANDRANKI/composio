/**
 * Generates a random RFC 4122 v4 UUID using the platform's `crypto` implementation.
 *
 * @returns A random UUID string, e.g. `"3f3f9b1e-5a2e-4c9a-8f1a-6b2e9c0d4f7a"`.
 */
export function getRandomUUID(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Generates a short, non-cryptographically-unique identifier derived from a random UUID.
 *
 * Takes the first 8 characters of a UUID (with hyphens removed), which is convenient for
 * things like short-lived correlation IDs where a full UUID would be unnecessarily verbose.
 *
 * @returns An 8-character alphanumeric identifier.
 */
export function getRandomShortId(): string {
  return getRandomUUID().slice(0, 8).replace(/-/g, '');
}
