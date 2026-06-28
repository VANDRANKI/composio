# Error Handling and Retry Patterns

This guide covers best practices for handling errors, rate limits, and
authentication failures when using the Composio SDK.

## 1. Error hierarchy

All Composio SDK errors extend `ComposioError`.

```
ComposioError
├── ComposioAuthError      — authentication / token issues
├── ComposioRateLimitError — 429 responses from the API
├── ComposioNotFoundError  — resource (tool, toolkit, account) not found
└── ComposioValidationError — invalid input to SDK methods
```

## 2. Catching specific errors

```typescript
import {
  ComposioAuthError,
  ComposioRateLimitError,
  ComposioNotFoundError,
} from '@composio/core';

try {
  await composio.tools.execute('GITHUB_CREATE_REPO', {
    userId: 'user-123',
    arguments: { name: 'my-repo' },
  });
} catch (err) {
  if (err instanceof ComposioAuthError) {
    // Redirect user to re-connect their GitHub account.
    await redirectToOAuth('github');
  } else if (err instanceof ComposioRateLimitError) {
    const retryAfter = err.retryAfterMs ?? 5_000;
    await sleep(retryAfter);
    // retry…
  } else if (err instanceof ComposioNotFoundError) {
    console.error('Tool or connected account not found:', err.message);
  } else {
    throw err; // re-throw unexpected errors
  }
}
```

## 3. Exponential backoff for rate limits

```typescript
async function executeWithRetry(
  toolSlug: string,
  args: Record<string, unknown>,
  userId: string,
  maxRetries = 3,
): Promise<unknown> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await composio.tools.execute(toolSlug, { userId, arguments: args });
    } catch (err) {
      if (err instanceof ComposioRateLimitError && attempt < maxRetries) {
        const delay = Math.min(1000 * 2 ** attempt, 30_000);
        await sleep(delay);
        attempt++;
      } else {
        throw err;
      }
    }
  }
}
```

## 4. Checking connected account status before execution

Verify the account is active to surface helpful errors early.

```typescript
const account = await composio.connectedAccounts.get({
  userId: 'user-123',
  toolkit: 'github',
});

if (account.status !== 'active') {
  throw new Error(`GitHub account is ${account.status}. Please reconnect.`);
}
```

## 5. Validating tool output

Always check `successful` before using `data`.

```typescript
const result = await composio.tools.execute('GITHUB_LIST_REPOS', {
  userId: 'user-123',
  arguments: {},
});

if (!result.successful) {
  throw new Error(`Tool execution failed: ${result.error}`);
}

console.log('Repos:', result.data);
```

## 6. Error handling checklist

- [ ] Catch `ComposioAuthError` and prompt for re-authentication
- [ ] Implement exponential backoff for `ComposioRateLimitError`
- [ ] Check `result.successful` before accessing `result.data`
- [ ] Verify connected account status before batch executions
- [ ] Re-throw unexpected errors to avoid swallowing bugs
