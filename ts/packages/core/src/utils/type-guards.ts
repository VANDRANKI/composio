/**
 * Type guard utilities for Composio SDK runtime validation.
 *
 * Narrows union types at runtime to avoid repeated `typeof` / `instanceof` checks.
 */

/** Checks whether a value is a non-null object. */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks whether a value is a non-empty string. */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Checks whether an object has a specific own property.
 *
 * @param obj - The object to inspect.
 * @param key - The property key to check.
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Checks whether a value is a plain error object with a message.
 *
 * @param value - The value to check.
 */
export function isErrorWithMessage(
  value: unknown
): value is { message: string } {
  return hasProperty(value, "message") && typeof value.message === "string";
}
