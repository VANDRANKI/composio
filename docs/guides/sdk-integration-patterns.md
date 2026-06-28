# Composio SDK Integration Patterns

This guide covers practical patterns for integrating Composio into AI agent
pipelines, handling authentication, executing tools, and managing errors.

## Initial Setup

```typescript
import { Composio } from '@composio/core';

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
});
```

Or use environment variable auto-detection:

```bash
export COMPOSIO_API_KEY=your_key_here
```

```typescript
// COMPOSIO_API_KEY is picked up automatically
const composio = new Composio();
```

---

## Pattern 1: Fetch and Execute a Single Tool

```typescript
const result = await composio.tools.execute('GITHUB_CREATE_ISSUE', {
  userId: 'user-42',
  arguments: {
    owner: 'my-org',
    repo: 'my-repo',
    title: 'Automated issue from agent',
    body: 'This issue was created by the Composio-powered agent.',
    labels: ['bot', 'automated'],
  },
});

if (result.error) {
  console.error('Tool execution failed:', result.error);
} else {
  console.log('Issue URL:', result.data.html_url);
}
```

---

## Pattern 2: Load Tools for an Agent (OpenAI)

```typescript
import OpenAI from 'openai';
import { OpenAIProvider } from '@composio/openai';

const openai = new OpenAI();
const provider = new OpenAIProvider();

// Fetch tool schemas formatted for OpenAI function calling
const tools = await composio.tools.get('user-42', {
  toolkits: ['github', 'slack'],
});
const openaiTools = provider.wrapTools(tools);

const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Create a GitHub issue about the memory leak.' }],
  tools: openaiTools,
  tool_choice: 'auto',
});

// Handle tool calls
const message = completion.choices[0].message;
if (message.tool_calls) {
  for (const call of message.tool_calls) {
    const toolResult = await composio.tools.execute(call.function.name, {
      userId: 'user-42',
      arguments: JSON.parse(call.function.arguments),
    });
    console.log('Result:', toolResult);
  }
}
```

---

## Pattern 3: Connected Account Verification

Before executing tools, verify the user has a connected account:

```typescript
const accounts = await composio.connectedAccounts.list({ userId: 'user-42' });
const githubConnected = accounts.some(
  (account) => account.appName === 'github' && account.status === 'ACTIVE'
);

if (!githubConnected) {
  // Redirect user to OAuth flow
  const authUrl = await composio.connectedAccounts.initiate({
    userId: 'user-42',
    appName: 'github',
    redirectUri: 'https://yourapp.com/auth/callback',
  });
  console.log('Connect GitHub:', authUrl.redirectUrl);
}
```

---

## Pattern 4: Custom Tools

```typescript
import { z } from 'zod';

const summaryTool = await composio.tools.createCustomTool({
  name: 'Summarise Text',
  description: 'Summarise a long text document into bullet points.',
  slug: 'CUSTOM_SUMMARISE_TEXT',
  inputParams: z.object({
    text: z.string().describe('The text to summarise.'),
    maxPoints: z.number().int().min(1).max(10).default(5).describe(
      'Maximum number of bullet points to return.'
    ),
  }),
  execute: async (input) => {
    // Your summarisation logic here
    const points = input.text
      .split('. ')
      .slice(0, input.maxPoints)
      .map((s) => `- ${s.trim()}`);
    return {
      data: { summary: points.join('\n') },
      error: null,
      successful: true,
    };
  },
});
```

---

## Pattern 5: Tool Output Modifiers

Transform tool inputs/outputs before they reach or leave the agent:

```typescript
const tools = await composio.tools.get('user-42', {
  toolkits: ['gmail'],
  modifiers: {
    before: (toolName, input) => {
      // Enforce a CC address on all emails
      if (toolName === 'GMAIL_SEND_EMAIL') {
        return { ...input, cc: [...(input.cc ?? []), 'audit@company.com'] };
      }
      return input;
    },
    after: (toolName, output) => {
      // Strip PII from logged outputs
      if (toolName.startsWith('GMAIL')) {
        const { body: _body, ...safe } = output;
        return safe;
      }
      return output;
    },
  },
});
```

---

## Error Handling

```typescript
try {
  const result = await composio.tools.execute('GITHUB_CREATE_REPO', {
    userId: 'user-42',
    arguments: { name: 'my-new-repo', private: true },
  });

  if (!result.successful) {
    throw new Error(`Tool failed: ${result.error}`);
  }

  return result.data;
} catch (err) {
  if (err instanceof ComposioAuthError) {
    // Token expired or not connected — re-initiate OAuth
    await initiateOAuth('user-42', 'github');
  } else if (err instanceof ComposioRateLimitError) {
    // Back off and retry
    await new Promise((r) => setTimeout(r, err.retryAfterMs));
  } else {
    throw err;
  }
}
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `COMPOSIO_API_KEY` | Yes | Your Composio account API key |
| `COMPOSIO_BASE_URL` | No | Override for self-hosted deployments |
| `COMPOSIO_LOG_LEVEL` | No | `silent`, `error`, `warn`, `info`, `debug` |
| `COMPOSIO_DISABLE_TELEMETRY` | No | Set `true` to opt out of usage analytics |
