import ComposioClient from '@composio/client';
import { FileToolModifier } from '#file_tool_modifier';
import {
  Tool,
  ToolExecuteParams,
  ToolListParamsSchema,
  ToolExecuteResponse,
  ToolList,
  ToolSchema,
  ToolListParams,
  ToolExecuteResponseSchema,
  ToolProxyParamsSchema,
  ToolProxyParams,
  ToolExecuteParamsSchema,
  ToolkitVersionParam,
  SchemaModifierOptions,
  ToolRetrievalOptions,
  ToolExecuteMetaParamsSchema,
} from '../types/tool.types';
import {
  ToolGetInputParams,
  ToolGetInputResponse,
  ToolProxyParams as ComposioToolProxyParams,
  ToolProxyResponse,
  ToolRetrieveEnumResponse,
  ToolRetrieveResponse,
  ToolListResponse as ComposioToolListResponse,
  ToolExecuteResponse as ComposioToolExecuteResponse,
  ToolListParams as ComposioToolListParams,
  ToolExecuteParams as ComposioToolExecuteParams,
} from '@composio/client/resources/tools';
import { CustomTools } from './CustomTools';
import { CustomToolInputParameter, CustomToolOptions } from '../types/customTool.types';
import {
  afterExecuteModifier,
  beforeExecuteModifier,
  ExecuteToolModifiers,
  SessionExecuteMetaModifiers,
  ProviderOptions,
  TransformToolSchemaModifier,
} from '../types/modifiers.types';
import { BaseComposioProvider } from '../provider/BaseProvider';
import logger from '../utils/logger';
import { ExecuteToolFn, GlobalExecuteToolFn } from '../types/provider.types';
import {
  ComposioCustomToolsNotInitializedError,
  ComposioInvalidModifierError,
  ComposioToolNotFoundError,
  ComposioProviderNotDefinedError,
  ComposioToolVersionRequiredError,
} from '../errors/ToolErrors';
import { ValidationError } from '../errors/ValidationErrors';
import { telemetry } from '../telemetry/Telemetry';
import { ComposioConfig } from '../composio';
import { getToolkitVersion } from '../utils/toolkitVersion';
import { handleToolExecutionError } from '../errors/ToolErrors';
import { ToolExecuteMetaParams } from '../types/tool.types';
import { SessionExecuteMetaParams } from '@composio/client/resources/tool-router.mjs';
import { CONFIG_DEFAULTS } from '../utils/config-defaults';

/**
 * Manages tool discovery, schema transformation, and execution for the Composio SDK.
 *
 * `Tools` is the primary sub-system of the `Composio` class and is accessed via
 * `composio.tools`. It handles:
 * - Fetching tool lists and individual tool schemas from the Composio API
 * - Wrapping tools in the format expected by the active AI provider
 * - Executing tools (both Composio-managed and custom user-defined tools)
 * - Applying before/after execution modifiers for input/output transformation
 * - Automatic file upload/download for tools that transfer binary content
 *
 * @typeParam TToolCollection - The provider-specific collection type returned by
 *   `provider.wrapTools()` (e.g. `OpenAI.Chat.ChatCompletionTool[]`).
 * @typeParam TTool - The provider-specific single-tool type.
 * @typeParam TProvider - The AI provider used for wrapping tools into framework-specific
 *   formats (e.g. OpenAI function-calling, Anthropic tool-use, etc.).
 *
 * @example Retrieve and execute tools with the default OpenAI provider
 * ```typescript
 * const composio = new Composio({ apiKey: 'your-api-key' });
 *
 * // Get GitHub tools wrapped for OpenAI function calling
 * const tools = await composio.tools.get('user-id', { toolkits: ['github'], limit: 5 });
 *
 * // Execute a specific tool
 * const result = await composio.tools.execute('GITHUB_GET_REPOS', {
 *   userId: 'user-id',
 *   version: '20250909_00',
 *   arguments: { owner: 'composio' },
 * });
 *
 * if (result.successful) {
 *   console.log(result.data);
 * }
 * ```
 */
export class Tools<
  TToolCollection,
  TTool,
  TProvider extends BaseComposioProvider<TToolCollection, TTool, unknown>,
> {
  private client: ComposioClient;
  private readonly customTools: CustomTools;
  private provider: TProvider;
  private autoUploadDownloadFiles: boolean;
  private toolkitVersions: ToolkitVersionParam;

  /**
   * Constructs a new `Tools` instance.
   *
   * This is called internally by the `Composio` constructor — you should not need
   * to instantiate `Tools` directly. Access it via `composio.tools` instead.
   *
   * @param client - The initialized `ComposioClient` used for all API calls.
   * @param config - The resolved SDK configuration, including the active provider,
   *   toolkit versions, and file-handling settings.
   * @throws {Error} If `client` is not provided.
   * @throws {ComposioProviderNotDefinedError} If `config.provider` is not set.
   */
  constructor(client: ComposioClient, config?: ComposioConfig<TProvider>) {
    if (!client) {
      throw new Error('ComposioClient is required');
    }
    if (!config?.provider) {
      throw new ComposioProviderNotDefinedError('Provider not passed into Tools instance');
    }

    this.client = client;
    this.customTools = new CustomTools(client);
    this.provider = config.provider;
    this.autoUploadDownloadFiles =
      config?.autoUploadDownloadFiles ?? CONFIG_DEFAULTS.autoUploadDownloadFiles;
    this.toolkitVersions = config?.toolkitVersions ?? CONFIG_DEFAULTS.toolkitVersions;
    // Bind the execute method to ensure correct 'this' context
    this.execute = this.execute.bind(this);
    // Set the execute method for the provider.
    this.provider._setExecuteToolFn(this.createExecuteFnForProviders());
    // Bind methods that use customTools to ensure correct 'this' context
    this.getRawComposioToolBySlug = this.getRawComposioToolBySlug.bind(this);
    this.getRawComposioTools = this.getRawComposioTools.bind(this);

    telemetry.instrument(this, 'Tools');
  }

  /**
   * Transforms tool data from snake_case API format to camelCase for internal SDK use.
   *
   * This method standardizes the property naming convention for tools retrieved from the Composio API,
   * making them more consistent with JavaScript/TypeScript conventions.
   *
   * @param {ToolRetrieveResponse | ComposioToolListResponse['items'][0]} tool - The tool object to transform
   * @returns {Tool} The transformed tool with camelCase properties
   *
   * @private
   */
  private transformToolCases(
    tool: ToolRetrieveResponse | ComposioToolListResponse['items'][0]
  ): Tool {
    return ToolSchema.parse({
      ...tool,
      inputParameters: tool.input_parameters,
      outputParameters: tool.output_parameters,
      availableVersions: tool.available_versions,
      isDeprecated: tool.deprecated?.is_deprecated ?? false,
      isNoAuth: tool.no_auth,
    });
  }

  /**
   * Transforms tool execution response from snake_case API format to camelCase.
   *
   * This method converts the response received from the Composio API to a standardized format
   * with consistent property naming that follows JavaScript/TypeScript conventions.
   *
   * @param {ComposioToolExecuteResponse} response - The raw API response to transform
   * @returns {ToolExecuteResponse} The transformed response with camelCase properties
   *
   * @private
   */
  private transformToolExecuteResponse(response: ComposioToolExecuteResponse): ToolExecuteResponse {
    return ToolExecuteResponseSchema.parse({
      data: response.data,
      error: response.error,
      successful: response.successful,
      logId: response.log_id,
      sessionInfo: response.session_info,
    });
  }

  /**
   * Applies the default schema modifiers to the tools
   * @param tools - The tools to apply the default schema modifiers to
   * @returns The tools with the default schema modifiers applied
   */
  private async applyDefaultSchemaModifiers(tools: Tool[]): Promise<Tool[]> {
    if (this.autoUploadDownloadFiles) {
      const fileToolModifier = new FileToolModifier(this.client);
      return await Promise.all(
        tools.map(tool =>
          fileToolModifier.modifyToolSchema(tool.slug, tool.toolkit?.slug ?? 'unknown', tool)
        )
      );
    } else {
      return tools;
    }
  }

  /**
   * Applies the before execute modifiers to the tool execution params
   * @param options.toolSlug - The slug of the tool
   * @param options.toolkitSlug - The slug of the toolkit
   * @param options.params - The params of the tool execution
   * @param modifier - The modifier to apply
   * @returns The modified params
   */
  private async applyBeforeExecuteModifiers(
    tool: Tool,
    {
      toolSlug,
      toolkitSlug,
      params,
    }: {
      toolSlug: string;
      toolkitSlug: string;
      params: ToolExecuteParams;
    },
    modifier?: beforeExecuteModifier
  ): Promise<ToolExecuteParams> {
    let modifiedParams = params;
    // if auto upload download files is enabled, upload the files to the Composio API
    if (this.autoUploadDownloadFiles) {
      const fileToolModifier = new FileToolModifier(this.client);
      modifiedParams = await fileToolModifier.fileUploadModifier(tool, {
        toolSlug,
        toolkitSlug,
        params: modifiedParams,
      });
    }
    // apply the before execute modifiers
    if (modifier) {
      if (typeof modifier === 'function') {
        modifiedParams = await modifier({
          toolSlug,
          toolkitSlug,
          params: modifiedParams,
        });
      } else {
        throw new ComposioInvalidModifierError('Invalid beforeExecute modifier. Not a function.');
      }
    }
    return modifiedParams;
  }

  /**
   * Applies the after execute modifiers to the tool execution result
   * @param options.toolSlug - The slug of the tool
   * @param options.toolkitSlug - The slug of the toolkit
   * @param options.result - The result of the tool execution
   * @param modifier - The modifier to apply
   * @returns The modified result
   */
  private async applyAfterExecuteModifiers(
    tool: Tool,
    {
      toolSlug,
      toolkitSlug,
      result,
    }: {
      toolSlug: string;
      toolkitSlug: string;
      result: ToolExecuteResponse;
    },
    modifier?: afterExecuteModifier
  ): Promise<ToolExecuteResponse> {
    let modifiedResult = result;
    // if auto upload download files is enabled, download the files from the Composio API
    if (this.autoUploadDownloadFiles) {
      const fileToolModifier = new FileToolModifier(this.client);
      modifiedResult = await fileToolModifier.fileDownloadModifier(tool, {
        toolSlug,
        toolkitSlug,
        result: modifiedResult,
      });
    }
    // apply the after execute modifiers
    if (modifier) {
      if (typeof modifier === 'function') {
        modifiedResult = await modifier({
          toolSlug,
          toolkitSlug,
          result: modifiedResult,
        });
      } else {
        throw new ComposioInvalidModifierError('Invalid afterExecute modifier. Not a function.');
      }
    }

    return modifiedResult;
  }

  /**
   * Fetches tools from the Composio API in raw (un-wrapped) format.
   *
   * Returns the tool schemas as plain objects, without passing them through the
   * active AI provider. This is useful when you need to inspect or transform tool
   * schemas before handing them to a framework, or when working outside any specific
   * AI SDK.
   *
   * Custom tools registered via `createCustomTool()` are merged into the result
   * alongside API-fetched tools.
   *
   * **Important:** You must supply at least one of `tools`, `toolkits`, `search`,
   * or `authConfigIds` — omitting all four throws a `ValidationError`.
   *
   * @param query - Filters that control which tools are returned.
   * @param query.tools - Fetch specific tools by slug (e.g. `['GITHUB_GET_REPOS']`).
   *   Cannot be combined with `toolkits`.
   * @param query.toolkits - Fetch all (or the most important) tools from one or more
   *   toolkits (e.g. `['github', 'slack']`). Cannot be combined with `tools`.
   * @param query.search - Full-text search across tool names and descriptions.
   * @param query.authConfigIds - Limit results to tools belonging to specific auth configs.
   * @param query.tags - Filter by tool tags.
   * @param query.limit - Maximum number of tools to return. When omitted and `toolkits`
   *   is set (without `tools`, `tags`, or `search`), Composio automatically filters
   *   to the most important tools.
   * @param query.important - Explicitly control whether to filter by importance. Defaults
   *   to `true` when `toolkits` is set without other filters.
   * @param options - Optional schema transformation configuration.
   * @param options.modifySchema - A function called for each tool, allowing you to
   *   add, remove, or rename fields before the tool is returned. The function receives
   *   `{ toolSlug, toolkitSlug, schema }` and must return the (possibly mutated) schema.
   * @returns A list of tools matching the query, with default schema modifiers
   *   (e.g. file-upload annotations) applied.
   * @throws {ValidationError} If `query` fails schema validation or required filters
   *   are missing.
   * @throws {ComposioInvalidModifierError} If `options.modifySchema` is not a function.
   *
   * @example Get the most important GitHub tools
   * ```typescript
   * const tools = await composio.tools.getRawComposioTools({ toolkits: ['github'] });
   * ```
   *
   * @example Get specific tools by slug
   * ```typescript
   * const tools = await composio.tools.getRawComposioTools({
   *   tools: ['GITHUB_GET_REPOS', 'HACKERNEWS_GET_USER'],
   * });
   * ```
   *
   * @example Search for tools and transform their schemas
   * ```typescript
   * const tools = await composio.tools.getRawComposioTools(
   *   { search: 'create issue' },
   *   {
   *     modifySchema: ({ toolSlug, schema }) => ({
   *       ...schema,
   *       description: `[CUSTOM] ${schema.description}`,
   *     }),
   *   }
   * );
   * ```
   */
  async getRawComposioTools(
    query: ToolListParams,
    options?: SchemaModifierOptions
  ): Promise<ToolList> {
    if ('tools' in query && 'toolkits' in query) {
      throw new ValidationError(
        'Invalid tool list parameters. You should not use tools and toolkits filter together.'
      );
    }

    const queryParams = ToolListParamsSchema.safeParse(query);
    if (queryParams.error) {
      throw new ValidationError('Invalid tool list parameters', {
        cause: queryParams.error,
      });
    }

    const shouldAutoApplyImportant =
      'toolkits' in queryParams.data &&
      !('tools' in queryParams.data) &&
      !('tags' in queryParams.data) &&
      !('search' in queryParams.data) &&
      // if the user provides a limit, do not apply the important flag
      !('limit' in queryParams.data) &&
      queryParams.data.important !== false;

    const effectiveImportant =
      'important' in queryParams.data ? queryParams.data.important : shouldAutoApplyImportant;

    // check if the query params contains atleast one of the following: tools, toolkits, search, authConfigIds
    if (
      !(
        'tools' in queryParams.data ||
        'toolkits' in queryParams.data ||
        'search' in queryParams.data ||
        'authConfigIds' in queryParams.data
      )
    ) {
      throw new ValidationError(
        'Invalid tool list parameters, atleast one of the following parameters is required: tools, toolkits, search, authConfigIds'
      );
    }

    // if tools are provided, set the limit to 9999 so that all tools are fetched
    let limit = 'limit' in queryParams.data ? queryParams.data.limit : undefined;
    if ('tools' in queryParams.data) {
      limit = 9999;
    }

    const filters: ComposioToolListParams = {
      ...('tools' in queryParams.data ? { tool_slugs: queryParams.data.tools?.join(',') } : {}),
      ...('toolkits' in queryParams.data
        ? { toolkit_slug: queryParams.data.toolkits?.join(',') }
        : {}),
      ...(limit ? { limit } : {}),
      ...('tags' in queryParams.data ? { tags: queryParams.data.tags } : {}),
      ...('scopes' in queryParams.data ? { scopes: queryParams.data.scopes } : {}),
      ...('search' in queryParams.data ? { search: queryParams.data.search } : {}),
      ...('authConfigIds' in queryParams.data
        ? { auth_config_ids: queryParams.data.authConfigIds }
        : {}),
      ...(effectiveImportant ? { important: 'true' } : {}),
      ...{ toolkit_versions: this.toolkitVersions },
    };

    logger.debug(`Fetching tools with filters: ${JSON.stringify(filters, null, 2)}`);

    const tools = await this.client.tools.list(filters);

    if (!tools) {
      return [];
    }
    const caseTransformedTools = tools.items.map(tool => this.transformToolCases(tool));

    const customTools = await this.customTools.getCustomTools({
      toolSlugs: 'tools' in queryParams.data ? queryParams.data.tools : undefined,
    });

    let modifiedTools = await this.applyDefaultSchemaModifiers([
      ...caseTransformedTools,
      ...customTools,
    ]);

    // apply local modifiers if they are provided
    if (options?.modifySchema) {
      const modifier = options.modifySchema;
      if (typeof modifier === 'function') {
        const modifiedPromises = modifiedTools.map(tool =>
          modifier({
            toolSlug: tool.slug,
            toolkitSlug: tool.toolkit?.slug ?? 'unknown',
            schema: tool,
          })
        );
        modifiedTools = await Promise.all(modifiedPromises);
      } else {
        throw new ComposioInvalidModifierError('Invalid schema modifier. Not a function.');
      }
    }

    return modifiedTools;
  }

  /**
   * Fetches the meta tools for a tool router session.
   * This method fetches the meta tools from the Composio API and transforms them to the expected format.
   * It provides access to the underlying meta tool data without provider-specific wrapping.
   *
   * @param sessionId {string} The session id to get the meta tools for
   * @param options {SchemaModifierOptions} Optional configuration for tool retrieval
   * @param {TransformToolSchemaModifier} [options.modifySchema] - Function to transform the tool schema
   * @returns {Promise<ToolList>} The list of meta tools
   *
   * @example
   * ```typescript
   * const metaTools = await composio.tools.getRawToolRouterMetaTools('session_123');
   * console.log(metaTools);
   * ```
   */
  async getRawToolRouterMetaTools(
    sessionId: string,
    options?: SchemaModifierOptions
  ): Promise<ToolList> {
    const tools = await this.client.toolRouter.session.tools(sessionId);
    let modifiedTools = tools.items.map(tool => this.transformToolCases(tool));
    // apply local modifiers if they are provided
    if (options?.modifySchema) {
      const modifier = options.modifySchema;
      if (typeof modifier === 'function') {
        const modifiedPromises = modifiedTools.map(tool =>
          modifier({
            toolSlug: tool.slug,
            toolkitSlug: tool.toolkit?.slug ?? 'unknown',
            schema: tool,
          })
        );
        modifiedTools = await Promise.all(modifiedPromises);
      } else {
        throw new ComposioInvalidModifierError('Invalid schema modifier. Not a function.');
      }
    }

    return modifiedTools;
  }

  /**
   * Retrieves a single tool by its slug in raw (un-wrapped) format.
   *
   * Fetches the full tool schema from the Composio API without passing it through
   * the active AI provider. Custom tools registered via `createCustomTool()` are
   * checked first — if a match is found, the API call is skipped.
   *
   * Toolkit version is resolved using the same priority as `execute()`:
   * 1. `options.version` (explicit call-site override)
   * 2. Per-toolkit version from `toolkitVersions` config (or env vars)
   * 3. `'latest'` as the final fallback
   *
   * @param slug - The unique tool identifier in `SCREAMING_SNAKE_CASE`
   *   (e.g. `'GITHUB_GET_REPOS'`, `'SLACK_SEND_MESSAGE'`).
   * @param options - Optional retrieval configuration.
   * @param options.version - Pin the fetch to a specific toolkit version string
   *   (e.g. `'20250909_00'`). Takes precedence over the SDK-level `toolkitVersions`.
   * @param options.modifySchema - A function to transform the tool schema before it
   *   is returned. Receives `{ toolSlug, toolkitSlug, schema }` and must return the
   *   (possibly mutated) schema.
   * @returns The requested tool with its complete schema, input/output parameters,
   *   available versions, and toolkit metadata.
   * @throws {ComposioToolNotFoundError} If no tool with the given slug exists.
   * @throws {ComposioInvalidModifierError} If `options.modifySchema` is not a function.
   *
   * @example Fetch a tool and inspect its input parameters
   * ```typescript
   * const tool = await composio.tools.getRawComposioToolBySlug('GITHUB_CREATE_ISSUE');
   * console.log(tool.inputParameters);
   * ```
   *
   * @example Fetch a specific pinned version
   * ```typescript
   * const tool = await composio.tools.getRawComposioToolBySlug('GITHUB_GET_REPOS', {
   *   version: '20250909_00',
   * });
   * console.log(tool.version); // '20250909_00'
   * ```
   */
  async getRawComposioToolBySlug(slug: string, options?: ToolRetrievalOptions): Promise<Tool> {
    // check if the tool is a custom tool
    const customTool = await this.customTools.getCustomToolBySlug(slug);
    if (customTool) {
      logger.debug(`Found ${slug} to be a custom tool`, JSON.stringify(customTool, null, 2));
      return customTool;
    } else {
      logger.debug(`Tool ${slug} is not a custom tool. Fetching from Composio API`);
    }
    // if not, fetch the tool from the Composio API
    let tool: ToolRetrieveResponse;
    try {
      // Build API call parameters based on version source
      const retrieveParams = options?.version
        ? { version: options.version } // Explicit version → use 'version' param
        : { toolkit_versions: this.toolkitVersions }; // SDK config → use 'toolkit_versions' param

      tool = await this.client.tools.retrieve(slug, retrieveParams);
    } catch (error) {
      throw new ComposioToolNotFoundError(`Unable to retrieve tool with slug ${slug}`, {
        cause: error,
      });
    }

    // change the case of the tool to camel case and apply default modifiers
    let [modifiedTool] = await this.applyDefaultSchemaModifiers([this.transformToolCases(tool)]);
    // apply local modifiers if they are provided
    if (options?.modifySchema) {
      const modifier = options.modifySchema;
      if (typeof modifier === 'function') {
        modifiedTool = await modifier({
          toolSlug: slug,
          toolkitSlug: modifiedTool.toolkit?.slug ?? 'unknown',
          schema: modifiedTool,
        });
      } else {
        throw new ComposioInvalidModifierError('Invalid schema modifier. Not a function.');
      }
    }
    return modifiedTool;
  }

  /**
   * Get a list of tools from Composio based on filters.
   * This method fetches the tools from the Composio API and wraps them using the provider.
   *
   * @param {string} userId - The user id to get the tools for
   * @param {ToolListParams} filters - The filters to apply when fetching tools
   * @param {ProviderOptions<TProvider>} [options] - Optional provider options including modifiers
   * @returns {Promise<ReturnType<T['wrapTools']>>} The wrapped tools collection
   *
   * @example
   * ```typescript
   * // Get tools from the GitHub toolkit
   * const tools = await composio.tools.get('default', {
   *   toolkits: ['github'],
   *   limit: 10
   * });
   *
   * // Get tools with search
   * const searchTools = await composio.tools.get('default', {
   *   search: 'user',
   *   limit: 10
   * });
   *
   * // Get a specific tool by slug
   * const hackerNewsUserTool = await composio.tools.get('default', 'HACKERNEWS_GET_USER');
   *
   * // Get a tool with schema modifications
   * const tool = await composio.tools.get('default', 'GITHUB_GET_REPOS', {
   *   modifySchema: (toolSlug, toolkitSlug, schema) => {
   *     // Customize the tool schema
   *     return {...schema, description: 'Custom description'};
   *   }
   * });
   * ```
   */
  async get<T extends TProvider>(
    userId: string,
    filters: ToolListParams,
    options?: ProviderOptions<TProvider>
  ): Promise<ReturnType<T['wrapTools']>>;

  /**
   * Get a specific tool by its slug.
   * This method fetches the tool from the Composio API and wraps it using the provider.
   *
   * @param {string} userId - The user id to get the tool for
   * @param {string} slug - The slug of the tool to fetch
   * @param {ProviderOptions<TProvider>} [options] - Optional provider options including modifiers
   * @returns {Promise<ReturnType<T['wrapTools']>>} The wrapped tool
   *
   * @example
   * ```typescript
   * // Get a specific tool by slug
   * const hackerNewsUserTool = await composio.tools.get('default', 'HACKERNEWS_GET_USER');
   *
   * // Get a tool with schema modifications
   * const tool = await composio.tools.get('default', 'GITHUB_GET_REPOS', {
   *   modifySchema: (toolSlug, toolkitSlug, schema) => {
   *     // Customize the tool schema
   *     return {...schema, description: 'Custom description'};
   *   }
   * });
   * ```
   */
  async get<T extends TProvider>(
    userId: string,
    slug: string,
    options?: ProviderOptions<TProvider>
  ): Promise<ReturnType<T['wrapTools']>>;

  /**
   * Get a tool or list of tools based on the provided arguments.
   * This is an implementation method that handles all overloads.
   *
   * @param {string} userId - The user id to get the tool(s) for
   * @param {ToolListParams | string} arg2 - Either a slug string or filters object
   * @param {ProviderOptions<TProvider> | ToolkitVersion} [arg3] - Optional provider options or version string
   * @param {ProviderOptions<TProvider>} [arg4] - Optional provider options (when arg3 is version)
   * @returns {Promise<TToolCollection>} The tool collection
   */
  async get(
    userId: string,
    arg2: ToolListParams | string,
    arg3?: ProviderOptions<TProvider>
  ): Promise<TToolCollection> {
    // Handle the two-parameter overloads
    const options = arg3 as ProviderOptions<TProvider>;

    // if the second argument is a string, get a single tool
    if (typeof arg2 === 'string') {
      const tool = await this.getRawComposioToolBySlug(arg2, {
        modifySchema: options?.modifySchema as TransformToolSchemaModifier,
      });
      return this.wrapToolsForProvider(
        userId,
        [tool],
        options as ExecuteToolModifiers
      ) as TToolCollection;
    } else {
      // if the second argument is an object, get a list of tools
      const tools = await this.getRawComposioTools(arg2, {
        modifySchema: options?.modifySchema as TransformToolSchemaModifier,
      });
      return this.wrapToolsForProvider(
        userId,
        tools,
        options as ExecuteToolModifiers
      ) as TToolCollection;
    }
  }
  /**
   * @internal
   * Creates a global execute tool function.
   * This function is used by providers to execute tools.
   * It skips the version check for provider controlled execution.
   * @returns {GlobalExecuteToolFn} The global execute tool function
   */
  private createExecuteFnForProviders(): GlobalExecuteToolFn {
    return async (slug: string, body: ToolExecuteParams, modifiers?: ExecuteToolModifiers) => {
      return await this.execute(
        slug,
        { ...body, dangerouslySkipVersionCheck: body.dangerouslySkipVersionCheck ?? true },
        modifiers
      );
    };
  }

  /**
   * @internal
   * Utility to wrap a given set of tools in the format expected by the provider
   *
   * @param userId - The user id to get the tools for
   * @param tools - The tools to wrap
   * @param modifiers - The modifiers to be applied to the tools
   * @returns The wrapped tools
   */
  wrapToolsForProvider<T extends TProvider>(
    userId: string,
    tools: Tool[],
    modifiers?: ExecuteToolModifiers
  ): ReturnType<T['wrapTools']> {
    const executeToolFn = this.createExecuteToolFn(userId, modifiers);
    return this.provider.wrapTools(tools, executeToolFn) as ReturnType<T['wrapTools']>;
  }

  /**
   * @internal
   * Utility to wrap a given set of tools in the format expected by the tool router
   *
   * @param {string} sessionId - The session id to execute the tool for
   * @param {Tool[]} tools - The tools to wrap
   * @param {SessionExecuteMetaModifiers} modifiers - The modifiers to apply to the tool
   * @returns {Tool[]} The wrapped tools
   */
  wrapToolsForToolRouter(
    sessionId: string,
    tools: Tool[],
    modifiers?: SessionExecuteMetaModifiers
  ): Tool[] {
    const executeToolFn = this.createExecuteToolFnForToolRouter(sessionId, modifiers);
    return this.provider.wrapTools(tools, executeToolFn) as Tool[];
  }

  /**
   * @internal
   * @description
   * Creates a function that executes a tool.
   * This function is used by agentic providers to execute the tool
   *
   * @param {string} userId - The user id
   * @param {ExecuteToolModifiers} modifiers - The modifiers to be applied to the tool
   * @returns {ExecuteToolFn} The execute tool function
   */
  private createExecuteToolFn(userId: string, modifiers?: ExecuteToolModifiers): ExecuteToolFn {
    const executeToolFn = async (toolSlug: string, input: Record<string, unknown>) => {
      return await this.execute(
        toolSlug,
        {
          userId,
          arguments: input,
          // dangerously skip version check for agentic tool execution via providers
          // this can be safe because most agentic flows users fetch latest version and then execute the tool
          dangerouslySkipVersionCheck: true,
        },
        modifiers
      );
    };
    return executeToolFn;
  }

  /**
   * @internal
   * Creates a function that executes a tool for a tool router session
   *
   * @param {string} sessionId - The session id to execute the tool for
   * @param {SessionExecuteMetaModifiers} modifiers - The modifiers to apply to the tool
   * @returns {ExecuteToolFn} The execute tool function
   */
  private createExecuteToolFnForToolRouter(
    sessionId: string,
    modifiers?: SessionExecuteMetaModifiers
  ): ExecuteToolFn {
    const executeToolFn = async (
      toolSlug: string,
      input: Record<string, unknown>
    ): Promise<ToolExecuteResponse> => {
      return await this.executeMetaTool(
        toolSlug,
        {
          sessionId,
          arguments: input,
        },
        modifiers
      );
    };
    return executeToolFn;
  }

  /**
   * @internal
   * Executes a composio tool via API without modifiers
   * @param tool - The tool to execute
   * @param body - The body of the tool execution
   * @returns The response from the tool execution
   */
  private async executeComposioTool(
    tool: Tool,
    body: ToolExecuteParams
  ): Promise<ToolExecuteResponse> {
    const toolkitVersion =
      body.version ?? getToolkitVersion(tool.toolkit?.slug ?? 'unknown', this.toolkitVersions);
    // if the version is latest and dangerouslySkipVersionCheck is not true, throw an error
    if (toolkitVersion === 'latest' && !body.dangerouslySkipVersionCheck) {
      throw new ComposioToolVersionRequiredError();
    }
    try {
      const result = await this.client.tools.execute(tool.slug, {
        allow_tracing: body.allowTracing,
        connected_account_id: body.connectedAccountId,
        custom_auth_params: body.customAuthParams
          ? {
              base_url: body.customAuthParams.baseURL,
              body: body.customAuthParams.body,
              parameters: body.customAuthParams.parameters,
            }
          : undefined,
        /**
         * @deprecated: customConnectionData
         * @description
         * This parameter is deprecated and will be removed in the future.
         * Please use custom_connection_data instead.
         *
         */
        custom_connection_data:
          body.customConnectionData as ComposioToolExecuteParams['custom_connection_data'],
        arguments: body.arguments,
        user_id: body.userId,
        version: toolkitVersion,
        text: body.text,
      });
      // transform the response to the ToolExecuteResponse format
      return this.transformToolExecuteResponse(result);
    } catch (error) {
      const toolError = handleToolExecutionError(tool.slug, error as Error);
      throw toolError;
    }
  }

  /**
   * Executes a tool by slug, applying before/after modifiers and handling both
   * Composio-managed and custom tools transparently.
   *
   * **Version resolution order:**
   * 1. `body.version` — explicit call-site version string (e.g. `'20250909_00'`)
   * 2. Per-toolkit version from `toolkitVersions` SDK config (or `COMPOSIO_TOOLKIT_VERSION_*` env vars)
   * 3. `'latest'` as the final fallback
   *
   * If the resolved version is `'latest'` and `body.dangerouslySkipVersionCheck` is not
   * `true`, a `ComposioToolVersionRequiredError` is thrown. This guards against
   * unexpected breakage when the API releases a new toolkit version.
   *
   * **Modifier execution order:**
   * 1. `modifiers.beforeExecute` — transform input arguments before the API call
   * 2. Tool execution (Composio API or custom handler)
   * 3. `modifiers.afterExecute` — transform the response after the API call
   *
   * @param slug - The unique tool identifier (e.g. `'GITHUB_GET_REPOS'`).
   * @param body - Execution parameters.
   * @param body.userId - The Composio user ID to execute the tool on behalf of.
   * @param body.arguments - Key-value map of tool input arguments.
   * @param body.version - Pin execution to a specific toolkit version.
   * @param body.connectedAccountId - Use a specific connected account (overrides
   *   automatic account selection).
   * @param body.dangerouslySkipVersionCheck - Allow execution when the resolved version
   *   is `'latest'`. Not recommended for production.
   * @param body.allowTracing - Enable request tracing for this execution.
   * @param modifiers - Optional lifecycle hooks.
   * @param modifiers.beforeExecute - Called with `{ toolSlug, toolkitSlug, params }`
   *   before execution. Must return the (possibly modified) params.
   * @param modifiers.afterExecute - Called with `{ toolSlug, toolkitSlug, result }`
   *   after execution. Must return the (possibly modified) result.
   * @returns The tool execution response.
   * @returns {boolean} response.successful - Whether the execution succeeded. Always
   *   check this before accessing `response.data`.
   * @returns {unknown} response.data - The tool output on success.
   * @returns {string | null} response.error - Error message on failure.
   * @returns {string} response.logId - Log ID for debugging with Composio support.
   * @throws {ComposioCustomToolsNotInitializedError} If the custom tools registry is not ready.
   * @throws {ComposioToolNotFoundError} If no tool with `slug` exists.
   * @throws {ComposioToolVersionRequiredError} If version is `'latest'` and
   *   `dangerouslySkipVersionCheck` is not `true`.
   * @throws {ComposioToolExecutionError} If the underlying tool call fails.
   *
   * @example Execute with a pinned version (recommended for production)
   * ```typescript
   * const result = await composio.tools.execute('GITHUB_GET_REPOS', {
   *   userId: 'default',
   *   version: '20250909_00',
   *   arguments: { owner: 'composio' },
   * });
   *
   * if (result.successful) {
   *   console.log(result.data);
   * } else {
   *   console.error(result.error);
   * }
   * ```
   *
   * @example Execute with `dangerouslySkipVersionCheck` (development / prototyping)
   * ```typescript
   * const result = await composio.tools.execute('HACKERNEWS_GET_USER', {
   *   userId: 'default',
   *   arguments: { userId: 'pg' },
   *   dangerouslySkipVersionCheck: true,
   * });
   * ```
   *
   * @example Execute with before/after modifiers
   * ```typescript
   * const result = await composio.tools.execute(
   *   'GITHUB_CREATE_ISSUE',
   *   { userId: 'default', version: '20250909_00', arguments: { owner: 'org', repo: 'repo', title: 'Bug' } },
   *   {
   *     beforeExecute: ({ params }) => ({ ...params, arguments: { ...params.arguments, labels: ['bug'] } }),
   *     afterExecute: ({ result }) => { console.log('done', result.logId); return result; },
   *   }
   * );
   * ```
   */
  async execute(
    slug: string,
    body: ToolExecuteParams,
    modifiers?: ExecuteToolModifiers
  ): Promise<ToolExecuteResponse> {
    if (!this.customTools) {
      throw new ComposioCustomToolsNotInitializedError(
        'CustomTools not initialized. Make sure Tools class is properly constructed.'
      );
    }

    const executeParams = ToolExecuteParamsSchema.safeParse(body);
    if (!executeParams.success) {
      throw new ValidationError('Invalid tool execute parameters', { cause: executeParams.error });
    }

    // Determine if it's a custom tool or composio tool
    const customTool = await this.customTools.getCustomToolBySlug(slug);
    const tool =
      customTool ??
      (await this.getRawComposioToolBySlug(slug, {
        version: body.version,
      }));
    const toolkitSlug = tool.toolkit?.slug ?? 'unknown';

    // Apply before execute modifiers
    const params = await this.applyBeforeExecuteModifiers(
      tool,
      {
        toolSlug: slug,
        toolkitSlug,
        params: executeParams.data,
      },
      modifiers?.beforeExecute
    );

    // Execute the tool (custom or composio)
    let result = customTool
      ? await this.customTools.executeCustomTool(customTool.slug, params)
      : await this.executeComposioTool(tool, params);

    // Apply after execute modifiers
    result = await this.applyAfterExecuteModifiers(
      tool,
      {
        toolSlug: slug,
        toolkitSlug,
        result,
      },
      modifiers?.afterExecute
    );

    return result;
  }

  /**
   * Executes a composio meta tool based on tool router session
   *
   * @param {string} toolSlug - The slug of the tool to execute
   * @param {ToolExecuteMetaParams} body - The execution parameters
   * @param {string} body.sessionId - The session id to execute the tool for
   * @param {Record<string, unknown>} body.arguments - The input to pass to the tool
   * @param {SessionExecuteMetaModifiers} modifiers - The modifiers to apply to the tool
   * @returns {Promise<ToolExecuteResponse>} The response from the tool execution
   */
  async executeMetaTool(
    toolSlug: string,
    body: ToolExecuteMetaParams,
    modifiers?: SessionExecuteMetaModifiers
  ): Promise<ToolExecuteResponse> {
    const executeMetaParams = ToolExecuteMetaParamsSchema.safeParse(body);
    if (!executeMetaParams.success) {
      throw new ValidationError('Invalid tool execute meta parameters', {
        cause: executeMetaParams.error,
      });
    }

    // Apply beforeExecute modifier if provided
    let modifiedParams = body.arguments ?? {};
    if (modifiers?.beforeExecute) {
      modifiedParams = await modifiers.beforeExecute({
        toolSlug,
        toolkitSlug: 'composio',
        sessionId: body.sessionId,
        params: modifiedParams,
      });
    }

    // Execute the meta tool
    const response = await this.client.toolRouter.session.executeMeta(body.sessionId, {
      // assert this because backend might keep adding more tool slugs
      slug: toolSlug as SessionExecuteMetaParams['slug'],
      arguments: modifiedParams,
    });

    // Prepare the result
    let result: ToolExecuteResponse = {
      data: response.data,
      error: response.error,
      successful: !response.error,
      logId: response.log_id,
    };

    // Apply afterExecute modifier if provided
    if (modifiers?.afterExecute) {
      result = await modifiers.afterExecute({
        toolSlug,
        toolkitSlug: 'composio',
        sessionId: body.sessionId,
        result,
      });
    }

    return result;
  }

  /**
   * Fetches the complete list of all available tool slugs as an enum.
   *
   * This is primarily used by the Composio CLI to build tab-completion lists and
   * tool discovery UIs. The result is cached on the server side — no additional
   * optimization is needed on the client. Unlike `getRawComposioTools()`, this
   * method requires no filter parameters.
   *
   * @returns A response object whose `items` array contains all tool slugs and
   *   their display names.
   *
   * @example
   * ```typescript
   * const { items } = await composio.tools.getToolsEnum();
   * const slugs = items.map(t => t.slug);
   * console.log(slugs); // ['GITHUB_GET_REPOS', 'SLACK_SEND_MESSAGE', ...]
   * ```
   */
  async getToolsEnum(): Promise<ToolRetrieveEnumResponse> {
    return this.client.tools.retrieveEnum();
  }

  /**
   * Fetches the resolved input parameters for a tool given a specific user context.
   *
   * Unlike `getRawComposioToolBySlug()` which returns the static schema, this method
   * evaluates the tool's parameter defaults and required fields against the user's
   * connected accounts — useful for pre-filling forms or building interactive prompts.
   *
   * @param slug - The tool slug (e.g. `'GITHUB_CREATE_ISSUE'`).
   * @param body - Context used to resolve the input parameters.
   * @param body.userId - The Composio user ID whose connected accounts are consulted.
   * @returns The resolved input parameter schema for the given user context.
   *
   * @example
   * ```typescript
   * const inputParams = await composio.tools.getInput('GITHUB_CREATE_ISSUE', {
   *   userId: 'user-123',
   * });
   * console.log(inputParams);
   * ```
   */
  async getInput(slug: string, body: ToolGetInputParams): Promise<ToolGetInputResponse> {
    return this.client.tools.getInput(slug, body);
  }

  /**
   * Sends a custom HTTP request to a toolkit's underlying API via Composio's proxy.
   *
   * Use this when a toolkit exposes endpoints that don't yet have a dedicated tool,
   * or when you need fine-grained control over the HTTP method, path, headers, and body.
   * Composio's proxy handles authentication (injecting OAuth tokens, API keys, etc.)
   * on behalf of the connected account, so you don't need to manage credentials directly.
   *
   * @param body - Proxy request parameters.
   * @param body.endpoint - The API path to call relative to the toolkit's base URL
   *   (e.g. `'/repos/owner/repo/issues'`).
   * @param body.method - HTTP method (`'GET'`, `'POST'`, `'PUT'`, `'PATCH'`, `'DELETE'`).
   * @param body.connectedAccountId - The connected account whose credentials are used
   *   to authenticate the proxied request.
   * @param body.body - Request body for `POST`/`PUT`/`PATCH` requests.
   * @param body.parameters - Additional headers or query parameters to include.
   * @returns The raw response from the toolkit's API.
   * @throws {ValidationError} If `body` fails schema validation.
   *
   * @example Send a custom GET request to the GitHub API
   * ```typescript
   * const response = await composio.tools.proxyExecute({
   *   endpoint: '/repos/composio/sdk/issues',
   *   method: 'GET',
   *   connectedAccountId: 'conn_abc123',
   * });
   * console.log(response.data);
   * ```
   */
  async proxyExecute(body: ToolProxyParams): Promise<ToolProxyResponse> {
    const toolProxyParams = ToolProxyParamsSchema.safeParse(body);
    if (!toolProxyParams.success) {
      throw new ValidationError('Invalid tool proxy parameters', { cause: toolProxyParams.error });
    }
    // convert the headers and query to the composio format
    // { name: string, type: 'header' | 'query', value: string }
    const parameters: ComposioToolProxyParams.Parameter[] = [];
    const parameterTypes = {
      header: 'header',
      query: 'query',
    } as const;

    if (toolProxyParams.data.parameters) {
      parameters.push(
        ...(toolProxyParams.data.parameters ?? []).map(value => ({
          name: value.name,
          type: value.in === 'header' ? parameterTypes.header : parameterTypes.query,
          value: value.value.toString(),
        }))
      );
    }

    return this.client.tools.proxy({
      endpoint: toolProxyParams.data.endpoint,
      method: toolProxyParams.data.method,
      body: toolProxyParams.data.body,
      connected_account_id: toolProxyParams.data.connectedAccountId,
      parameters: parameters,
      /**
       * @deprecated: customConnectionData
       * @description
       * This parameter is deprecated and will be removed in the future.
       * Please use custom_auth_params instead.
       *
       */
      // @ts-ignore
      custom_connection_data: toolProxyParams.data.customConnectionData,
    });
  }

  /**
   * Registers a custom tool that can be executed alongside Composio-managed tools.
   *
   * Custom tools let you extend Composio's tool library with your own logic while
   * keeping a consistent interface. Once registered, custom tools are returned by
   * `getRawComposioTools()` and `getRawComposioToolBySlug()` alongside API tools,
   * and can be executed via `execute()` using the same call signature.
   *
   * @param body - Configuration for the custom tool.
   * @param body.name - Human-readable display name.
   * @param body.description - Natural-language description used by the LLM to decide
   *   when to call this tool.
   * @param body.slug - Unique identifier in `SCREAMING_SNAKE_CASE` (e.g. `'MY_TOOL'`).
   *   Must not conflict with existing Composio tool slugs.
   * @param body.inputParameters - A Zod schema describing the tool's input. Each field's
   *   `.describe()` annotation is surfaced to the LLM as the parameter description.
   * @param body.execute - Async function that implements the tool logic. Receives the
   *   validated input and must return `{ data, error, successful }`.
   * @param body.toolkitSlug - Optional toolkit to associate this tool with.
   * @param body.userId - Optional user ID scope for per-user custom tools.
   * @returns The registered tool as a `Tool` object (same shape as API-fetched tools).
   *
   * @example Register a custom tool without a toolkit
   * ```typescript
   * import { z } from 'zod';
   *
   * const myTool = await composio.tools.createCustomTool({
   *   name: 'Fetch Weather',
   *   description: 'Get the current weather for a city',
   *   slug: 'FETCH_WEATHER',
   *   inputParameters: z.object({
   *     city: z.string().describe('The city to fetch weather for'),
   *   }),
   *   execute: async ({ city }) => {
   *     const data = await fetchWeatherApi(city);
   *     return { data, error: null, successful: true };
   *   },
   * });
   * ```
   */
  async createCustomTool<T extends CustomToolInputParameter>(
    body: CustomToolOptions<T>
  ): Promise<Tool> {
    return this.customTools.createTool(body);
  }
}
