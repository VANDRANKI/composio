/**
 * Reads a single environment variable from `process.env`.
 *
 * Falls back to `defaultValue` (default: `undefined`) when the variable is
 * absent, empty, or when `process.env` is unavailable (e.g. in browser or
 * edge runtimes where `process` is not defined).
 *
 * @param name - The name of the environment variable to read.
 * @param defaultValue - Value to return when the variable is not set.
 *                       Defaults to `undefined`.
 * @returns The value of the environment variable, or `defaultValue` if it
 *          cannot be resolved.
 *
 * @example
 * ```ts
 * // Returns the value of COMPOSIO_API_KEY, or undefined if not set
 * const apiKey = getEnvVariable('COMPOSIO_API_KEY');
 *
 * // Returns 'https://api.composio.dev' when BASE_URL is unset
 * const baseUrl = getEnvVariable('BASE_URL', 'https://api.composio.dev');
 * ```
 */
export const getEnvVariable = (
  name: string,
  defaultValue: string | undefined = undefined
): string | undefined => {
  try {
    return process.env[name] || defaultValue;
  } catch (_e) {
    return defaultValue;
  }
};

/**
 * Returns all environment variables whose names start with a given prefix.
 *
 * Useful for collecting namespaced configuration at runtime, for example
 * toolkit version pins:
 *
 * ```
 * COMPOSIO_TOOLKIT_VERSION_GITHUB=20250902_00
 * COMPOSIO_TOOLKIT_VERSION_SLACK=20250902_00
 * COMPOSIO_TOOLKIT_VERSION_GMAIL=latest
 * ```
 *
 * Returns an empty object when `process.env` is unavailable (e.g. browser
 * or edge runtimes) or when no variables match the prefix.
 *
 * @param prefix - The prefix string to filter environment variable names by.
 * @returns A record mapping matching variable names to their string values.
 *          The record is empty if no matches are found or if `process.env`
 *          is not accessible.
 *
 * @example
 * ```ts
 * // Given:
 * //   COMPOSIO_TOOLKIT_VERSION_GITHUB=20250902_00
 * //   COMPOSIO_TOOLKIT_VERSION_SLACK=20250902_00
 * const versions = getEnvsWithPrefix('COMPOSIO_TOOLKIT_VERSION_');
 * // => { COMPOSIO_TOOLKIT_VERSION_GITHUB: '20250902_00', COMPOSIO_TOOLKIT_VERSION_SLACK: '20250902_00' }
 * ```
 */
export const getEnvsWithPrefix = (prefix: string): Record<string, string> => {
  try {
    if (process && process.env) {
      return Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] =>
            entry[0].startsWith(prefix) && entry[1] !== undefined
        )
      );
    } else {
      return {};
    }
  } catch (error) {
    return {};
  }
};
