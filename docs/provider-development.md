# Composio Provider Development Guide

This guide explains how to add a new AI provider integration to the Composio SDK.

## Provider Structure

Each provider lives in `ts/packages/providers/<name>/` and must export:
- A class extending `BaseProvider`
- `wrapTool(tool)` method for single-tool wrapping
- `wrapTools(tools)` method for batch wrapping

## Creating a Provider

```bash
# Scaffold a new provider
pnpm create:provider my-provider

# Or an agentic provider (with execution handlers)
pnpm create:provider my-provider --agentic
```

## Provider Implementation

```typescript
import { BaseProvider } from "@composio/core";
import type { ComposioTool, WrappedTool } from "@composio/core";

export class MyProvider extends BaseProvider {
  /**
   * Wrap a single Composio tool for use with this AI framework.
   *
   * @param tool - The Composio tool definition to wrap.
   * @returns A tool object compatible with the target framework's API.
   */
  wrapTool(tool: ComposioTool): WrappedTool {
    return {
      name: tool.slug,
      description: tool.description,
      parameters: this.convertSchema(tool.inputParams),
      execute: async (params: Record<string, unknown>) => {
        return this.executeTool(tool.slug, params);
      },
    };
  }

  /**
   * Wrap multiple tools in a single batch operation.
   *
   * @param tools - Array of Composio tool definitions.
   * @returns Array of framework-compatible tool objects.
   */
  wrapTools(tools: ComposioTool[]): WrappedTool[] {
    return tools.map((tool) => this.wrapTool(tool));
  }
}
```

## Testing

```bash
# Run unit tests
pnpm test

# Test a specific package
cd ts/packages/providers/my-provider
pnpm test

# Run with coverage
pnpm test:coverage
```

## Environment Variables

Required for testing:

```bash
export COMPOSIO_API_KEY="your-api-key"
export OPENAI_API_KEY="your-openai-key"  # for OpenAI provider tests
```

## Code Quality

```bash
# Lint and format
pnpm lint:fix
pnpm format

# Type checking
pnpm tsc --noEmit
```

## Publishing

```bash
# Create a changeset
pnpm changeset

# Version packages
pnpm changeset:version

# Publish (CI only)
pnpm changeset:release
```
