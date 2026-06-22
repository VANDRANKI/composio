import type { BaseComposioProvider } from './provider/BaseProvider';
import ComposioClient from '@composio/client';
import { Tools } from './models/Tools';
import { Toolkits } from './models/Toolkits';
import { Triggers } from './models/Triggers';
import { AuthConfigs } from './models/AuthConfigs';
import { ConnectedAccounts } from './models/ConnectedAccounts';
import { MCP } from './models/MCP';
import { telemetry } from './telemetry/Telemetry';
import { getSDKConfig, getToolkitVersionsFromEnv } from './utils/sdk';
import logger from './utils/logger';
import { COMPOSIO_LOG_LEVEL, IS_DEVELOPMENT_OR_CI } from './utils/constants';
import { checkForLatestVersionFromNPM } from './utils/version';
import { OpenAIProvider } from './provider/OpenAIProvider';
import { version } from '../package.json';
import type { ComposioRequestHeaders } from './types/composio.types';
import { Files } from '#files';
import { getDefaultHeaders } from './utils/session';
import { ToolkitVersionParam } from './types/tool.types';
import { ToolRouter } from './models/ToolRouter';
import { ToolRouterCreateSessionConfig, Session } from './types/toolRouter.types';
import { CONFIG_DEFAULTS } from './utils/config-defaults';

export type ComposioConfig<
  TProvider extends BaseComposioProvider<unknown, unknown, unknown> = OpenAIProvider,
> = {
  /**
   * The API key for the Composio API.
   * @example 'sk-1234567890'
   */
  apiKey?: string | null;
  /**
   * The base URL of the Composio API.
   * @example 'https://backend.composio.dev'
   */
  baseURL?: string | null;
  /**
   * Whether to allow tracking for the Composio instance.
   * @example true, false
   * @default true
   */
  allowTracking?: boolean;
  /**
   * Whether to automatically upload and download files during tool execution.
   * @example true, false
   * @default true
   */
  autoUploadDownloadFiles?: boolean;
  /**
   * The tool provider to use for this Composio instance.
   * @example new OpenAIProvider()
   */
  provider?: TProvider;
  /**
   * The host service name of the SDK where the SDK is running.
   * This is used to identify the host for telemetry. Ignore it if you are not using telemetry.
   * @example 'mcp', 'apollo', ' etc
   */
  host?: string;
  /**
   * Request options to be passed to the Composio API client.
   * This is useful for passing in a custom fetch implementation.
   * @example
   * ```typescript
   * const composio = new Composio({
   *   defaultHeaders: {
   *      'x-request-id': '1234567890',
   *   },
   * });
   * ```
   */
  defaultHeaders?: ComposioRequestHeaders;
  /**
   * Whether to disable version check for the Composio SDK.
   * @example true, false
   * @default false
   */
  disableVersionCheck?: boolean;
  /**
   * The versions of the toolkits to use for tool execution and retrieval.
   * Omit to use 'latest' for all toolkits.
   *
   * **Version Control:**
   * When executing tools manually (via `tools.execute()`), if this resolves to "latest",
   * you must either:
   * - Set `dangerouslySkipVersionCheck: true` in the execute params (not recommended for production)
   * - Specify a concrete version here or in environment variables
   * - Pass a specific `version` parameter to the execute call
   *
   * Defaults to 'latest' if nothing is provided.
   * You can specify individual toolkit versions via environment variables: `COMPOSIO_TOOLKIT_VERSION_GITHUB=20250902_00`
   *
   * @example Global version for all toolkits, omit to use 'latest'
   * ```typescript
   * const composio = new Composio();
   * ```
   *
   * @example Specific versions for different toolkits (recommended for production)
   * ```typescript
   * const composio = new Composio({
   *   toolkitVersions: {
   *     github: '20250909_00',
   *     slack: '20250902_00'
   *   }
   * });
   * ```
   *
   * @example Set via environment variables
   * ```typescript
   * // Set environment variables:
   * // COMPOSIO_TOOLKIT_VERSION_GITHUB=20250909_00
   * // COMPOSIO_TOOLKIT_VERSION_SLACK=20250902_00
   * const composio = new Composio(); // Will use env variables
   * ```
   */
  toolkitVersions?: ToolkitVersionParam;
};

/**
 * The main entry point for the Composio SDK.
 *
 * `Composio` provides a unified interface to Composio's tool platform: list and execute
 * tools, manage toolkit connections and authentication, subscribe to triggers, interact
 * with MCP servers, and upload/download files. All sub-systems are accessible as
 * properties on the instance.
 *
 * @typeParam TProvider - The AI provider type used to wrap tools for framework-specific
 *   consumption. Defaults to `OpenAIProvider` (OpenAI function-calling format).
 *
 * @example Basic setup with default provider (OpenAI)
 * ```typescript
 * import { Composio } from '@composio/core';
 *
 * const composio = new Composio({ apiKey: 'your-api-key' });
 *
 * // Fetch GitHub tools for a user
 * const tools = await composio.tools.get('user-id', { toolkits: ['github'] });
 * ```
 *
 * @example Using a custom AI provider
 * ```typescript
 * import { Composio } from '@composio/core';
 * import { AnthropicProvider } from '@composio/anthropic';
 *
 * const composio = new Composio({
 *   apiKey: 'your-api-key',
 *   provider: new AnthropicProvider(),
 * });
 *
 * // Tools will be wrapped in Anthropic tool format
 * const tools = await composio.tools.get('user-id', { toolkits: ['slack'] });
 * ```
 *
 * @example Pinning toolkit versions for production stability
 * ```typescript
 * const composio = new Composio({
 *   apiKey: 'your-api-key',
 *   toolkitVersions: {
 *     github: '20250909_00',
 *     slack: '20250902_00',
 *   },
 * });
 * ```
 */
export class Composio<
  TProvider extends BaseComposioProvider<unknown, unknown, unknown> = OpenAIProvider,
> {
  /**
   * The Composio API client.
   * @type {ComposioClient}
   */
  protected client: ComposioClient;

  /**
   * The configuration for the Composio SDK.
   * @type {ComposioConfig<TProvider>}
   */
  private config: ComposioConfig<TProvider>;

  /**
   * Core models for Composio.
   */

  /** List, retrieve, and execute tools */
  tools: Tools<unknown, unknown, TProvider>;
  /** Retrieve toolkit metadata and authorize user connections */
  toolkits: Toolkits;
  /** Manage webhook triggers and event subscriptions */
  triggers: Triggers<TProvider>;
  /** The tool provider instance used for wrapping tools in framework-specific formats */
  provider: TProvider;
  /** Upload and download files */
  files: Files;
  /** Manage authentication configurations for toolkits */
  authConfigs: AuthConfigs;
  /** Manage authenticated connections */
  connectedAccounts: ConnectedAccounts;
  /** Model Context Protocol server management */
  mcp: MCP;
  /**
   * Experimental feature, use with caution
   * @experimental
   */
  toolRouter: ToolRouter<unknown, unknown, TProvider>;
  /**
   * Creates a new tool router session for a user.
   *
   * A tool router session groups tool execution under a single session context,
   * enabling Composio to apply session-level policies (connection management,
   * rate limiting, audit logging) across all tool calls made within the session.
   *
   * @param userId - The user ID to create the session for. Use a stable identifier
   *   that maps to your application's user model (e.g. a UUID or email address).
   * @param routerConfig - Optional configuration for the tool router session.
   * @param routerConfig.manageConnections - When `true`, Composio automatically
   *   selects the best connected account for each tool call rather than requiring
   *   callers to specify `connectedAccountId` explicitly.
   * @returns A `Session` object containing the session ID, a redirect URL for
   *   connection authorization flows, and a `tools()` method to fetch session tools.
   *
   * @example
   * ```typescript
   * import { Composio } from '@composio/core';
   *
   * const composio = new Composio();
   * const userId = 'user_123';
   *
   * const session = await composio.create(userId, {
   *  manageConnections: true,
   * });
   *
   * console.log(session.sessionId);
   * console.log(session.url);
   * console.log(session.tools());
   * ```
   */
  create: (
    userId: string,
    routerConfig?: ToolRouterCreateSessionConfig
  ) => Promise<Session<unknown, unknown, TProvider>>;

  /**
   * Resumes an existing tool router session by ID.
   *
   * Use this when a session was created in a previous request (e.g. stored in a
   * database) and you want to continue executing tools under the same session
   * context without creating a new one.
   *
   * @param id - The session ID returned by a previous `composio.create()` call.
   * @returns The existing `Session` object, ready for tool retrieval and execution.
   *
   * @example
   * ```typescript
   * // Resume a session created in a previous request
   * const session = await composio.use('session_abc123');
   * const tools = await session.tools();
   * ```
   */
  use: (id: string) => Promise<Session<unknown, unknown, TProvider>>;

  /**
   * Creates a new instance of the Composio SDK.
   *
   * The constructor initializes the SDK with the provided configuration options,
   * sets up the API client, and initializes all core models (tools, toolkits, etc.).
   *
   * @param {ComposioConfig<TProvider>} config - Configuration options for the Composio SDK
   * @param {string} [config.apiKey] - The API key for authenticating with the Composio API
   * @param {string} [config.baseURL] - The base URL for the Composio API (defaults to production URL)
   * @param {boolean} [config.allowTracking=true] - Whether to allow anonymous usage analytics
   * @param {TProvider} [config.provider] - The provider to use for this Composio instance (defaults to OpenAIProvider)
   *
   * @example
   * ```typescript
   * // Initialize with default configuration
   * const composio = new Composio();
   *
   * // Initialize with custom API key and base URL
   * const composio = new Composio({
   *   apiKey: 'your-api-key',
   *   baseURL: 'https://api.composio.dev'
   * });
   *
   * // Initialize with custom provider
   * const composio = new Composio({
   *   apiKey: 'your-api-key',
   *   provider: new CustomProvider()
   * });
   * ```
   */
  constructor(config?: ComposioConfig<TProvider>) {
    const { baseURL: baseURLParsed, apiKey: apiKeyParsed } = getSDKConfig(
      config?.baseURL,
      config?.apiKey
    );

    if (IS_DEVELOPMENT_OR_CI) {
      logger.debug(`Initializing Composio w API Key: [REDACTED] and baseURL: ${baseURLParsed}`);
    }

    /**
     * Set the default provider, if not provided by the user.
     */
    this.provider = (config?.provider ?? new OpenAIProvider()) as TProvider;

    /**
     * Keep a reference to the config object.
     * This is useful for creating a builder pattern, debugging and logging.
     */
    this.config = {
      ...config,
      baseURL: baseURLParsed,
      apiKey: apiKeyParsed,
      toolkitVersions: getToolkitVersionsFromEnv(config?.toolkitVersions),
      allowTracking: config?.allowTracking ?? CONFIG_DEFAULTS.allowTracking,
      autoUploadDownloadFiles:
        config?.autoUploadDownloadFiles ?? CONFIG_DEFAULTS.autoUploadDownloadFiles,
      provider: config?.provider ?? this.provider,
    };

    const defaultHeaders = getDefaultHeaders(this.config.defaultHeaders, this.provider);

    /**
     * Initialize the Composio SDK client.
     * The client is used to make API calls to the Composio API.
     */
    this.client = new ComposioClient({
      apiKey: apiKeyParsed,
      baseURL: baseURLParsed,
      defaultHeaders: defaultHeaders,
      logLevel: COMPOSIO_LOG_LEVEL,
    });

    this.tools = new Tools(this.client, this.config);
    this.mcp = new MCP(this.client);
    this.toolkits = new Toolkits(this.client);
    this.triggers = new Triggers(this.client, this.config);
    this.authConfigs = new AuthConfigs(this.client);
    this.files = new Files(this.client);
    this.connectedAccounts = new ConnectedAccounts(this.client);
    this.toolRouter = new ToolRouter(this.client, this.config);

    /**
     * Initialize tool router methods
     * Properly bind the methods to maintain the correct 'this' context
     */
    this.create = this.toolRouter.create.bind(this.toolRouter);
    this.use = this.toolRouter.use.bind(this.toolRouter);

    /**
     * Initialize the client telemetry.
     */
    if (this.config.allowTracking) {
      telemetry.setup({
        apiKey: apiKeyParsed ?? '',
        baseUrl: baseURLParsed ?? '',
        isAgentic: this.provider?._isAgentic || false,
        version: version,
        isBrowser: typeof window !== 'undefined',
        provider: this.provider?.name ?? 'openai',
        host: this.config.host,
      });
    }
    // instrument the composio instance
    telemetry.instrument(this, 'Composio');
    // instrument the provider since we are not using the provider class directly
    telemetry.instrument(
      this.provider,
      this.provider.name ?? this.provider.constructor.name ?? 'unknown'
    );

    // Check for the latest version of the Composio SDK from NPM.
    if (!this.config.disableVersionCheck) {
      checkForLatestVersionFromNPM(version);
    }
  }

  /**
   * Returns the underlying Composio API client.
   *
   * Prefer accessing data through the higher-level models (`tools`, `toolkits`, etc.).
   * Use this method only when you need to make raw API calls that are not yet exposed
   * through a model (e.g. during migration or for advanced use cases).
   *
   * @returns The `ComposioClient` instance used by this SDK instance.
   * @throws {Error} If the client was somehow not initialized (should never happen in
   *   normal usage — indicates a constructor bug if it does).
   *
   * @example
   * ```typescript
   * const client = composio.getClient();
   * const raw = await client.tools.list({ toolkit_slug: 'github' });
   * ```
   */
  getClient(): ComposioClient {
    if (!this.client) {
      throw new Error('Composio client is not initialized. Please initialize it first.');
    }
    return this.client;
  }

  /**
   * Returns the configuration this SDK instance was initialized with.
   *
   * Useful for inspecting effective values after defaults and environment variables
   * have been applied (e.g. confirming which `baseURL` was resolved, or checking
   * the active `toolkitVersions` map).
   *
   * @returns A read-only snapshot of the resolved `ComposioConfig` for this instance.
   *
   * @example
   * ```typescript
   * const config = composio.getConfig();
   * console.log(config.baseURL);        // resolved base URL
   * console.log(config.toolkitVersions); // resolved per-toolkit versions
   * ```
   */
  getConfig(): ComposioConfig<TProvider> {
    return this.config;
  }

  /**
   * Creates a new Composio instance with custom request headers, inheriting all
   * other configuration from this instance.
   *
   * This is useful when you need per-request tracing headers (e.g. `x-request-id`,
   * `x-correlation-id`) without reconstructing the full SDK instance for each request.
   * The returned instance shares no mutable state with the parent — all API calls
   * made through it will carry the supplied headers.
   *
   * @deprecated This method will be removed in a future version. Prefer passing
   *   `defaultHeaders` at construction time or using middleware in your HTTP layer.
   *
   * @param options - Options for the new session.
   * @param options.headers - HTTP headers to attach to every API call made through
   *   the returned instance. Merged with (and override) the parent instance's headers.
   * @returns A new `Composio` instance configured with the given headers.
   *
   * @example
   * ```typescript
   * // Create a base Composio instance
   * const composio = new Composio({
   *   apiKey: 'your-api-key'
   * });
   *
   * // Create a session with request tracking headers
   * const composioWithCustomHeaders = composio.createSession({
   *   headers: {
   *     'x-request-id': '1234567890',
   *     'x-correlation-id': 'session-abc-123',
   *     'x-custom-header': 'custom-value'
   *   }
   * });
   *
   * // Use the session for making API calls with the custom headers
   * await composioWithCustomHeaders.tools.list();
   * ```
   */
  createSession(options?: { headers?: ComposioRequestHeaders }): Composio<TProvider> {
    const sessionHeaders = getDefaultHeaders(options?.headers, this.provider);
    return new Composio({
      ...this.config,
      defaultHeaders: sessionHeaders,
    });
  }

  /**
   * Flushes any pending telemetry events and waits for delivery to complete.
   *
   * In Node.js-compatible environments, telemetry is flushed automatically on
   * `process.exit`. In edge runtimes (Cloudflare Workers, Vercel Edge) that do not
   * expose process exit hooks, call this method manually and pass the returned
   * promise to the runtime's "wait until" mechanism so the worker is not evicted
   * before delivery finishes.
   *
   * @returns A promise that resolves once all queued telemetry events have been
   *   delivered (or the flush timeout has elapsed).
   *
   * @example Cloudflare Workers
   * ```typescript
   * export default {
   *   async fetch(request: Request, env: Env, ctx: ExecutionContext) {
   *     const composio = new Composio({ apiKey: env.COMPOSIO_API_KEY });
   *
   *     const result = await composio.tools.execute('GITHUB_GET_REPOS', {
   *       userId: 'default',
   *       arguments: { owner: 'composio' },
   *       dangerouslySkipVersionCheck: true,
   *     });
   *
   *     // Ensure telemetry flushes before the worker terminates
   *     ctx.waitUntil(composio.flush());
   *
   *     return new Response(JSON.stringify(result));
   *   }
   * };
   * ```
   */
  async flush(): Promise<void> {
    await telemetry.flush();
  }
}
