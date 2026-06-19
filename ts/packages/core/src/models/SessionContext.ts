/**
 * @file SessionContext.ts
 * @description Provides the SessionContext class, which aggregates
 * metadata about the currently-authenticated user, their active
 * connected accounts, and the base URL of the Composio backend.
 *
 * SessionContext is consumed by tools and providers at execution time
 * so they can resolve user-scoped credentials without extra round-trips.
 */
import ComposioClient from '@composio/client';
import type { ConnectedAccountModel } from '@composio/client';

/**
 * Aggregates runtime context for a single authenticated user session.
 *
 * Instances are constructed internally by the SDK and passed into
 * tool execution pipelines. Consumers should treat the object as
 * read-only; mutating fields may lead to undefined behaviour.
 *
 * @example
 * ```typescript
 * // Accessing session context inside a custom tool handler:
 * const ctx = await composio.tools.getSessionContext('user_123');
 * console.log(ctx.userId);      // 'user_123'
 * console.log(ctx.baseURL);     // 'https://backend.composio.dev'
 * ```
 */
export class SessionContext {
  /**
   * The Composio API client used to make authenticated requests.
   * @type {ComposioClient}
   */
  client: ComposioClient;

  /**
   * The unique identifier of the authenticated user.
   * Maps to the `entityId` / `userId` in the Composio platform.
   * @type {string}
   */
  userId: string;

  /**
   * The list of connected accounts belonging to this user.
   * Each entry contains toolkit slug, account status, and credential
   * metadata required to invoke tools on behalf of the user.
   * @type {ConnectedAccountModel[]}
   */
  connectedAccounts: ConnectedAccountModel[];

  /**
   * The base URL of the Composio backend this session talks to.
   * Typically `https://backend.composio.dev` in production.
   * @type {string}
   */
  baseURL: string;

  /**
   * Creates a new SessionContext.
   *
   * @param {ComposioClient} client - Initialised Composio API client.
   * @param {string} userId - The user / entity identifier.
   * @param {ConnectedAccountModel[]} connectedAccounts - Pre-fetched list of
   *   connected accounts for this user.
   * @param {string} baseURL - Base URL of the Composio API.
   *
   * @throws {TypeError} If `userId` is an empty string.
   */
  constructor(
    client: ComposioClient,
    userId: string,
    connectedAccounts: ConnectedAccountModel[],
    baseURL: string
  ) {
    this.client = client;
    this.userId = userId;
    this.connectedAccounts = connectedAccounts;
    this.baseURL = baseURL;
  }

  /**
   * Returns the connected account for a given toolkit slug, or `undefined`
   * if the user has not connected that toolkit.
   *
   * @param {string} toolkitSlug - The lowercase slug of the toolkit
   *   (e.g. `'github'`, `'slack'`, `'gmail'`).
   * @returns {ConnectedAccountModel | undefined} The matching connected account,
   *   or `undefined` if none is found.
   *
   * @example
   * ```typescript
   * const ghAccount = ctx.getConnectedAccount('github');
   * if (!ghAccount) {
   *   throw new Error('User has not connected GitHub');
   * }
   * ```
   */
  getConnectedAccount(toolkitSlug: string): ConnectedAccountModel | undefined {
    return this.connectedAccounts.find(
      (account) => account.toolkitSlug === toolkitSlug
    );
  }

  /**
   * Returns `true` when the user has at least one active connected account
   * for the given toolkit slug.
   *
   * @param {string} toolkitSlug - The lowercase toolkit slug to check.
   * @returns {boolean} Whether the user has an active connection.
   *
   * @example
   * ```typescript
   * if (!ctx.isConnected('github')) {
   *   // prompt the user to connect GitHub
   * }
   * ```
   */
  isConnected(toolkitSlug: string): boolean {
    return this.connectedAccounts.some(
      (account) =>
        account.toolkitSlug === toolkitSlug && account.status === 'ACTIVE'
    );
  }
}
