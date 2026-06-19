/**
 * Retry utilities for Composio SDK network operations.
 *
 * Provides exponential backoff with jitter for transient API failures.
 */

/** Options for controlling retry behaviour. */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3). */
  maxAttempts?: number;
  /** Base delay in milliseconds before the first retry (default: 500). */
  baseDelayMs?: number;
  /** Maximum delay cap in milliseconds (default: 10_000). */
  maxDelayMs?: number;
  /** Whether to add random jitter to avoid thundering herd (default: true). */
  jitter?: boolean;
}

export function calculateBackoffDelay(
  attempt: number,
  options: RetryOptions = {}
): number {
  const { baseDelayMs = 500, maxDelayMs = 10_000, jitter = true } = options;
  const exponential = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  if (!jitter) return exponential;
  return exponential * (0.75 + Math.random() * 0.5);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3 } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        const delay = calculateBackoffDelay(attempt, options);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
