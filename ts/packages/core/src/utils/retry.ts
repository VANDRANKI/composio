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

/**
 * Calculate the delay before a retry attempt using exponential backoff.
 *
 * @param attempt - Zero-indexed attempt number (0 = first retry).
 * @param options - Retry configuration options.
 * @returns Delay in milliseconds.
 */
export function calculateBackoffDelay(
  attempt: number,
  options: RetryOptions = {}
): number {
  const {
    baseDelayMs = 500,
    maxDelayMs = 10_000,
    jitter = true,
  } = options;

  const exponential = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  if (!jitter) return exponential;
  return exponential * (0.75 + Math.random() * 0.5);
}

/**
 * Execute an async operation with automatic retries on failure.
 *
 * @param fn - Async function to execute.
 * @param options - Retry configuration options.
 * @returns The resolved value of `fn`.
 * @throws The last error if all attempts are exhausted.
 */
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
