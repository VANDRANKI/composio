# Composio TypeScript SDK Type Guide

This guide covers the type system used in `@composio/core` and provider packages,
common patterns for avoiding `any` leakage, and how to type custom tool handlers.

## Core Types

### `ComposioToolSchema`

Represents a single tool definition with its JSON Schema input spec:

```typescript
import type { ComposioToolSchema } from '@composio/core';

const schema: ComposioToolSchema = {
  name: 'GITHUB_CREATE_ISSUE',
  description: 'Create a new GitHub issue.',
  parameters: {
    type: 'object',
    properties: {
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
      title: { type: 'string', description: 'Issue title.' },
    },
    required: ['owner', 'repo', 'title'],
  },
};
```

### `ToolExecutionResult`

All tool executions return a discriminated union based on `successful`:

```typescript
import type { ToolExecutionResult } from '@composio/core';

async function runTool(toolName: string, params: Record<string, unknown>) {
  const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
  const result: ToolExecutionResult = await composio.tools.execute(toolName, {
    userId: 'user-123',
    arguments: params,
  });

  if (result.successful) {
    // result.data is typed as Record<string, unknown>
    console.log('Success:', result.data);
  } else {
    // result.error is typed as string
    console.error('Error:', result.error);
  }
}
```

**Do not** use `result.data` without first checking `result.successful` —
`data` is only defined when `successful === true`.

## Typing Provider Wrappers

Provider packages wrap Composio tools for their respective AI SDK format.
When implementing a new provider, use generics to preserve type safety:

```typescript
import type { ComposioToolSchema } from '@composio/core';

// OpenAI tool format
interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

function wrapTool(schema: ComposioToolSchema): OpenAITool {
  return {
    type: 'function',
    function: {
      name: schema.name,
      description: schema.description,
      parameters: schema.parameters,
    },
  };
}

function wrapTools(schemas: ComposioToolSchema[]): OpenAITool[] {
  return schemas.map(wrapTool);
}
```

## Custom Tool Handlers

When registering custom tool execute handlers, type the input and output:

```typescript
import { z } from 'zod';
import { Composio } from '@composio/core';

const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

const InputSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST']).default('GET'),
  body: z.string().optional(),
});

type HttpInput = z.infer<typeof InputSchema>;

await composio.tools.createCustomTool({
  name: 'HTTP Request',
  description: 'Make an HTTP request to any URL.',
  slug: 'HTTP_REQUEST',
  inputParams: InputSchema,
  execute: async (input: HttpInput) => {
    const response = await fetch(input.url, {
      method: input.method,
      body: input.body,
    });
    const text = await response.text();
    return {
      data: { status: response.status, body: text },
      error: null,
      successful: true,
    };
  },
});
```

## Avoiding `any` in SDK Consumer Code

The most common source of `any` is accessing `result.data` without narrowing:

```typescript
// WRONG: data is Record<string, unknown> but we access it unsafely
const result = await composio.tools.execute('GITHUB_CREATE_ISSUE', params);
const issueNumber = result.data.number as number;  // unsafe cast

// CORRECT: use Zod to validate and type the result
const IssueResultSchema = z.object({
  number: z.number(),
  html_url: z.string(),
  title: z.string(),
});

if (result.successful) {
  const issue = IssueResultSchema.parse(result.data);
  console.log(`Created issue #${issue.number}: ${issue.html_url}`);
}
```

## Environment Variable Types

Never access `process.env.X` without providing a fallback or throwing:

```typescript
// WRONG: may be undefined at runtime
const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

// CORRECT: validate at startup
const apiKey = process.env.COMPOSIO_API_KEY;
if (!apiKey) {
  throw new Error('COMPOSIO_API_KEY environment variable is not set.');
}
const composio = new Composio({ apiKey });
```
