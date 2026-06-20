#!/usr/bin/env python3
"""Test connectivity to the Composio API and verify tool availability.

Usage::

    COMPOSIO_API_KEY=your-key python scripts/test_connection.py
    COMPOSIO_API_KEY=your-key python scripts/test_connection.py --toolkit GITHUB
"""

from __future__ import annotations

import argparse
import os
import sys


def check_api_key() -> str:
    """Ensure the COMPOSIO_API_KEY environment variable is set.

    Returns:
        The API key string.

    Raises:
        SystemExit: If the key is not set.
    """
    key = os.environ.get("COMPOSIO_API_KEY", "").strip()
    if not key:
        print(
            "ERROR: COMPOSIO_API_KEY environment variable is not set.",
            file=sys.stderr,
        )
        sys.exit(1)
    return key


def test_connection(api_key: str) -> bool:
    """Attempt to connect to the Composio API.

    Args:
        api_key: Composio API key.

    Returns:
        ``True`` if the connection succeeds.
    """
    try:
        from composio import Composio
    except ImportError:
        print("ERROR: composio package is not installed. Run: pip install composio",
              file=sys.stderr)
        sys.exit(1)

    try:
        client = Composio(api_key=api_key)
        # A lightweight call that validates the API key.
        _ = client.tools.get(user_id="__health_check__", toolkits=[])
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"Connection failed: {exc}")
        return False


def list_toolkit_tools(api_key: str, toolkit: str) -> None:
    """Print available tools for a given toolkit.

    Args:
        api_key: Composio API key.
        toolkit: Toolkit name (e.g. ``"GITHUB"`` or ``"SLACK"``)
    """
    from composio import Composio

    client = Composio(api_key=api_key)
    tools = client.tools.get(user_id="__list__", toolkits=[toolkit])
    print(f"Tools in toolkit '{toolkit}': {len(tools)}")
    for tool in tools[:20]:
        slug = getattr(tool, "slug", str(tool))
        desc = getattr(tool, "description", "")
        print(f"  {slug}: {desc[:60]}")


def main() -> None:
    """Entry point for the connectivity test script."""
    parser = argparse.ArgumentParser(description="Test Composio API connectivity.")
    parser.add_argument("--toolkit", help="Toolkit name to list tools for (optional).")
    args = parser.parse_args()

    api_key = check_api_key()
    print("Testing connection to Composio API...")
    ok = test_connection(api_key)
    if ok:
        print("[OK] Connected successfully.")
    else:
        print("[FAIL] Connection failed.")
        sys.exit(1)

    if args.toolkit:
        list_toolkit_tools(api_key, args.toolkit.upper())


if __name__ == "__main__":
    main()
