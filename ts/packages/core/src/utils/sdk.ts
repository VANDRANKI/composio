import { ComposioNoAPIKeyError } from '../errors/SDKErrors';
import { COMPOSIO_DIR, DEFAULT_BASE_URL, USER_DATA_FILE_NAME } from './constants';
import { getEnvsWithPrefix, getEnvVariable } from './env';
import logger from './logger';
import { ComposioError } from '../errors/ComposioError';
import { ToolkitVersion, ToolkitVersionParam, ToolkitVersions } from '../types/tool.types';
import { platform } from '#platform';

/**
 * Returns the absolute path to the Composio user-data JSON file
 * (`~/.composio/user_data.json`), or `null` if the home directory
 * cannot be determined or the platform does not support a file system.
 *
 * The file stores persistent per-user configuration such as the API key
 * and base URL set via `composio login`.
 *
 * @returns The absolute file path, or `null` on failure.
 *
 * @example
 * ```typescript
 * const path = userDataPath();
 * if (path) {
 *   console.log('User data stored at:', path);
 * }
 * ```
 */
export const userDataPath = () => {
  try {
    const homeDir = platform.homedir();
    if (!homeDir) {
      return null;
    }
    return platform.joinPath(homeDir, COMPOSIO_DIR, USER_DATA_FILE_NAME);
  } catch (_error) {
    logger.debug('Environment', `Unable to get user data path`);
    return null;
  }
};

/**
 * Reads and parses the user data JSON file from the Composio directory.
 *
 * @returns The parsed user data object containing user configuration (api_key, base_url, etc.), or empty object if file doesn't exist or can't be read
 */
export const getUserDataJson = () => {
  try {
    const dataPath = userDataPath();
    if (!dataPath || !platform.supportsFileSystem) {
      return {};
    }
    const data = platform.readFileSync(dataPath, 'utf8');
    return JSON.parse(data as string);
  } catch (_error) {
    logger.debug('Environment', 'No user data file found');
    return {};
  }
};

/**
 * Resolves the base URL and API key used to initialise the Composio client.
 *
 * Resolution priority for **base URL** (first truthy value wins):
 * 1. `baseUrl` argument
 * 2. `COMPOSIO_BASE_URL` environment variable
 * 3. `base_url` field in `~/.composio/user_data.json`
 * 4. {@link DEFAULT_BASE_URL} constant
 *
 * Resolution priority for **API key** (first truthy value wins):
 * 1. `apiKey` argument
 * 2. `COMPOSIO_API_KEY` environment variable
 * 3. `api_key` field in `~/.composio/user_data.json`
 *
 * @param baseUrl - Optional caller-supplied base URL override.
 * @param apiKey  - Optional caller-supplied API key override.
 * @returns An object with `baseURL` and `apiKey` strings.
 * @throws {ComposioNoAPIKeyError} If no API key can be resolved from any source.
 *
 * @example
 * ```typescript
 * // Typical usage — reads from env / user config automatically
 * const { baseURL, apiKey } = getSDKConfig();
 *
 * // Explicit overrides take precedence over env and user config
 * const { baseURL, apiKey } = getSDKConfig('https://my-proxy.example.com', 'sk-test-key');
 * ```
 */
export function getSDKConfig(baseUrl?: string | null, apiKey?: string | null) {
  const userData = getUserDataJson();
  const { api_key: apiKeyFromUserConfig, base_url: baseURLFromUserConfig } = userData;

  const baseURLParsed =
    baseUrl || getEnvVariable('COMPOSIO_BASE_URL') || baseURLFromUserConfig || DEFAULT_BASE_URL;
  const apiKeyParsed = apiKey || getEnvVariable('COMPOSIO_API_KEY') || apiKeyFromUserConfig || '';

  if (!apiKeyParsed) {
    ComposioError.handleAndThrow(new ComposioNoAPIKeyError());
  }

  logger.debug('Environment', `API Key: ${apiKeyParsed}`);
  logger.debug('Environment', `Base URL: ${baseURLParsed}`);

  return { baseURL: baseURLParsed, apiKey: apiKeyParsed };
}

/**
 * Gets toolkit versions configuration by merging environment variables, user-provided defaults, and fallbacks.
 *
 * Priority order:
 * 1. If defaultVersions is a string, use it as global version for all toolkits
 * 2. Environment variables (COMPOSIO_TOOLKIT_VERSION_<TOOLKIT_NAME>)
 * 3. User-provided toolkit version mappings (defaultVersions object)
 * 4. Fallback to 'latest' if no versions are configured
 *
 * @param defaultVersions - Optional default versions configuration (string for global version or object mapping toolkit names to versions)
 * @returns Toolkit versions configuration - either a global version string, toolkit-specific version mapping, or 'latest'
 */
export function getToolkitVersionsFromEnv(
  defaultVersions?: ToolkitVersionParam
): ToolkitVersionParam {
  // if already set by user either a single version or 'latest' use that as is / override everything else
  if (defaultVersions && typeof defaultVersions === 'string') {
    return defaultVersions;
  }

  // check if there are envs similar to COMPOSIO_TOOLKIT_VERSION_GITHUB then extract the toolkit name
  const envPrefixedVersions = getEnvsWithPrefix(`COMPOSIO_TOOLKIT_VERSION_`);
  const toolkitVersionsFromEnv = Object.entries(envPrefixedVersions).reduce((acc, [key, value]) => {
    const toolkitName = key.replace('COMPOSIO_TOOLKIT_VERSION_', '');
    acc[toolkitName.toLowerCase()] = value as ToolkitVersion;
    return acc;
  }, {} as ToolkitVersions);

  // if the provided default versions is an object, normalize the keys to be lower case
  // use user provided values as overrides
  let userProvidedToolkitVersions = {};
  if (defaultVersions && typeof defaultVersions === 'object') {
    userProvidedToolkitVersions = Object.fromEntries(
      Object.entries(defaultVersions).map(([key, value]) => [key.toLowerCase(), value])
    );
  }

  // final toolkit versions
  const toolkitVersions = {
    ...toolkitVersionsFromEnv,
    ...userProvidedToolkitVersions,
  };

  // if the toolkitVersions are empty, use 'latest'
  if (Object.keys(toolkitVersions).length === 0) {
    return 'latest';
  }

  return toolkitVersions;
}
