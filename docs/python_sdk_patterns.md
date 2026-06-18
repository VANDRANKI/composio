# Composio Python SDK Patterns

This guide covers type annotation patterns, error handling, and testing
conventions for the Composio Python SDK.

## Type Annotations

The Python SDK uses Pydantic v2 for all request/response models.
All public methods must have full type annotations:

```python
from typing import Optional
from composio import Composio, ToolExecutionResult

composio = Composio(api_key="your-key")

def execute_tool(
    tool_name: str,
    user_id: str,
    arguments: dict[str, object],
) -> Optional[dict[str, object]]:
    """Execute a Composio tool and return result data on success.

    Args:
        tool_name: Composio tool slug, e.g. 'GITHUB_CREATE_ISSUE'.
        user_id: The user ID whose connected account to use.
        arguments: Tool input arguments.

    Returns:
        The result data dict if successful, or None on failure.
    """
    result: ToolExecutionResult = composio.tools.execute(
        tool_name,
        user_id=user_id,
        arguments=arguments,
    )
    if result.successful:
        return result.data
    return None
```

## Error Handling

Composio raises `ComposioError` subclasses for different failure modes:

```python
from composio.exceptions import (
    ComposioAuthError,        # invalid API key or expired token
    ComposioRateLimitError,   # 429 from the API
    ComposioToolNotFoundError,# tool slug doesn't exist
    ComposioError,            # base class for all Composio errors
)

try:
    result = composio.tools.execute("GITHUB_CREATE_ISSUE", ...)
except ComposioAuthError:
    print("Check your COMPOSIO_API_KEY")
except ComposioRateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s.")
except ComposioToolNotFoundError as e:
    print(f"Unknown tool: {e.tool_name}")
except ComposioError as e:
    print(f"Composio error: {e}")
```

## Testing with Mocks

```python
from unittest.mock import MagicMock, patch
from composio import Composio

def test_execute_tool_returns_none_on_failure():
    mock_result = MagicMock()
    mock_result.successful = False
    mock_result.error = "Connected account not found"

    with patch.object(Composio, "tools") as mock_tools:
        mock_tools.execute.return_value = mock_result
        composio = Composio(api_key="test-key")
        result = execute_tool("GITHUB_CREATE_ISSUE", "user-1", {})
        assert result is None
```
