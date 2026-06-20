# Error Handling in the Composio SDK

This guide explains how errors are structured in the Composio SDK and how to
handle them correctly in your application.

---

## Error hierarchy

All Composio SDK errors extend a base `ComposioError` class:

```
ComposioError
├── AuthenticationError    # Invalid or missing API key
├── NotFoundError          # Tool, toolkit, or connected account not found
├── RateLimitError         # Too many requests
├── ValidationError        # Invalid input parameters
└── ToolExecutionError     # Tool ran but returned an error from the remote service
```

---

## TypeScript

```typescript
import { Composio, ComposioError, AuthenticationError, ToolExecutionError } from '@composio/core';

const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

try {
  const result = await composio.tools.execute('GITHUB_CREATE_ISSUE', {
    userId: 'user@example.com',
    arguments: { owner: 'acme', repo: 'backend', title: 'Bug report' },
  });

  if (!result.successful) {
    // Tool ran but the remote service returned an error
    console.error('Tool failed:', result.error);
  }
} catch (err) {
  if (err instanceof AuthenticationError) {
    console.error('Check your COMPOSIO_API_KEY environment variable');
  } else if (err instanceof ComposioError) {
    console.error(`Composio error [${err.code}]: ${err.message}`);
  } else {
    throw err;  // Re-throw unexpected errors
  }
}
```

---

## Python

```python
from composio import Composio
from composio.exceptions import AuthenticationError, ToolExecutionError

composio = Composio(api_key=os.environ["COMPOSIO_API_KEY"])

try:
    result = composio.tools.execute(
        "GITHUB_CREATE_ISSUE",
        user_id="user@example.com",
        arguments={"owner": "acme", "repo": "backend", "title": "Bug report"},
    )
except AuthenticationError:
    print("Check your COMPOSIO_API_KEY environment variable")
except ToolExecutionError as exc:
    print(f"Tool execution failed: {exc.message}")
    print(f"Remote error: {exc.remote_error}")
```

---

## Checking `result.successful`

Even when the SDK call does not raise an exception, always check
`result.successful` before using `result.data`:

```python
result = composio.tools.execute("SLACK_SEND_MESSAGE", ...)
if not result.successful:
    # The Slack API returned an error (e.g. invalid channel)
    raise RuntimeError(f"Slack message failed: {result.error}")

ts = result.data["ts"]  # safe to access after the check
```

---

## Rate limiting

The SDK automatically retries on `429 Too Many Requests` with exponential
back-off. To disable retries or adjust the limit:

```typescript
const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  maxRetries: 0,   // disable automatic retries
});
```
