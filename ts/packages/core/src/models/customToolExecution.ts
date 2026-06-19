/**
 * @file customToolExecution.ts
 * @description Utilities for executing user-defined custom tools within the
 * Composio SDK pipeline.
 *
 * Custom tools bypass the normal tool-registry lookup and invoke a
 * user-supplied execute function directly.  This module contains the
 * shared execution logic so that both `Tools.execute()` and the
 * ToolRouter session can delegate to a single, well-tested path.
 *
 * @see {@link https://docs.composio.dev/sdk/custom-tools}
 */
import type { CustomTool } from './CustomTool';

/**
 * Result shape returned by a custom-tool execution.
 */
export interface CustomToolExecutionResult {
  /** The structured payload produced by the tool's execute function. */
  data: Record<string, unknown>;
  /** Human-readable error description, or `null` on success. */
  error: string | null;
  /** `true` when the tool completed without error. */
  successful: boolean;
}

/**
 * Execute a custom tool's handler with the provided input arguments.
 *
 * Wraps the user-supplied `execute` function in a try/catch so that
 * uncaught errors are normalised into a failed
 * {@link CustomToolExecutionResult} instead of propagating as
 * unhandled rejections.
 *
 * @param tool - The custom tool definition, including its `execute`
 *   callback.
 * @param input - Arbitrary key-value map of arguments validated against
 *   `tool.inputParams` by the caller before this function is invoked.
 * @returns A promise that always resolves to a
 *   {@link CustomToolExecutionResult}; it never rejects.
 *
 * @example
 * ```typescript
 * const result = await executeCustomTool(myTool, { query: 'hello' });
 * if (!result.successful) {
 *   console.error('Tool failed:', result.error);
 * }
 * ```
 */
export async function executeCustomTool(
  tool: CustomTool,
  input: Record<string, unknown>
): Promise<CustomToolExecutionResult> {
  try {
    const data = await tool.execute(input);
    return {
      data: data as Record<string, unknown>,
      error: null,
      successful: true,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      data: {},
      error: errorMessage,
      successful: false,
    };
  }
}
