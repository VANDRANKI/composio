# Provider Development Best Practices

This guide covers patterns for building robust Composio provider integrations.

## Provider Structure

Every provider package in `ts/packages/providers/` follows this structure:

```
@composio/<name>/
├── src/
│   ├── index.ts          # Public exports
│   └── provider.ts       # Main provider class
├── test/
│   └── provider.test.ts  # Unit tests
├── package.json
└── tsconfig.json
```

## Implementing `wrapTools`

The `wrapTools` method transforms Composio tool definitions into the format expected by the AI framework:

```typescript
import type { ComposioTool, WrappedTool } from '@composio/core';

export class MyAIProvider {
  wrapTools(tools: ComposioTool[]): WrappedTool[] {
    return tools.map((tool) => ({
      name: tool.slug,
      description: tool.description,
      parameters: tool.inputParams,
      execute: async (args: Record<string, unknown>) => {
        return tool.execute(args);
      },
    }));
  }
}
```

## Retry Logic for Transient Failures

Network calls to Composio APIs can fail transiently. Use a typed retry helper:

```typescript
type RetryOptions = {
  maxRetries: number;
  baseDelayMs: number;
  shouldRetry?: (error: unknown) => boolean;
};

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxRetries, baseDelayMs, shouldRetry = () => true } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Usage
const result = await withRetry(
  () => composio.tools.execute('GITHUB_CREATE_ISSUE', { title: 'Bug report' }),
  { maxRetries: 3, baseDelayMs: 500 },
);
```

## Input Validation

Validate tool inputs before execution to surface clear errors:

```typescript
import { z } from 'zod';

const CreateIssueInput = z.object({
  title: z.string().min(1, 'Title cannot be empty'),
  body: z.string().optional(),
  labels: z.array(z.string()).default([]),
});

async function executeWithValidation(
  input: unknown,
): Promise<void> {
  const parsed = CreateIssueInput.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }
  // proceed with parsed.data
}
```

## Error Classification

Distinguish between retryable and non-retryable errors:

```typescript
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // Network timeouts and rate limits are retryable
  return (
    error.message.includes('ECONNRESET') ||
    error.message.includes('429') ||
    error.message.includes('503')
  );
}
```

## Testing Providers

Use the mock client to test provider logic without hitting the Composio API:

```typescript
import { createMockComposio } from '@composio/core/test-utils';
import { MyAIProvider } from '../src/provider';

test('wrapTools returns correct format', async () => {
  const mockClient = createMockComposio();
  const provider = new MyAIProvider();
  const tools = await mockClient.tools.get('user-123', { toolkits: ['github'] });
  const wrapped = provider.wrapTools(tools);

  expect(wrapped).toHaveLength(tools.length);
  expect(wrapped[0]).toHaveProperty('name');
  expect(wrapped[0]).toHaveProperty('execute');
});
```

## Best Practices

1. **Use strict TypeScript** — enable `strict: true` in `tsconfig.json`.
2. **Document with TSDoc** — all public methods need JSDoc comments.
3. **Test error paths** — mock network failures and verify retry behavior.
4. **Keep providers thin** — business logic belongs in `@composio/core`, not providers.
5. **Export types** — re-export types users need so they don't reach into internal paths.
