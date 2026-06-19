/**
 * Type guard utilities for Composio SDK runtime validation.
 */

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return isObject(obj) && Object.prototype.hasOwnProperty.call(obj, key);
}

export function isErrorWithMessage(value: unknown): value is { message: string } {
  return hasProperty(value, "message") && typeof value.message === "string";
}
