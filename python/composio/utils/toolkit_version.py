"""
Utilities for resolving toolkit versions from config, environment variables,
and user-supplied defaults.

The resolution helpers in this module keep the TypeScript and Python SDKs
behaviorally consistent: both give precedence to an explicit string override,
then per-toolkit env vars, then a caller-supplied mapping, and finally fall
back to ``'latest'``.
"""

import os
import typing as t

from composio.core.types import ToolkitVersion, ToolkitVersionParam, ToolkitVersions

_ENV_PREFIX = "COMPOSIO_TOOLKIT_VERSION_"


def _get_toolkit_versions_from_env() -> ToolkitVersions:
    """Scan the process environment for ``COMPOSIO_TOOLKIT_VERSION_*`` variables.

    Keys are normalised to lower-case toolkit slugs so lookups are consistent
    with the rest of the SDK (e.g. ``COMPOSIO_TOOLKIT_VERSION_GITHUB`` becomes
    the key ``"github"``).

    :returns: A mapping of toolkit slug to version string (may be empty).
    """
    versions: ToolkitVersions = {}
    for key, value in os.environ.items():
        if key.startswith(_ENV_PREFIX):
            toolkit_name = key[len(_ENV_PREFIX) :].lower()
            versions[toolkit_name] = value
    return versions


def get_toolkit_version(
    toolkit_slug: str, toolkit_versions: t.Optional[ToolkitVersionParam] = None
) -> ToolkitVersion:
    """
    Resolve the version string for a specific toolkit.

    Resolution order:

    1. If *toolkit_versions* is a ``str`` (e.g. ``'latest'`` or a date-based
       version like ``'20250902_00'``), use it as a global version for **all**
       toolkits, including this one.
    2. If *toolkit_versions* is a ``dict``, look up *toolkit_slug* in the
       mapping and return the associated version, or ``'latest'`` if the slug
       is absent from the mapping.
    3. If *toolkit_versions* is ``None``, check for a
       ``COMPOSIO_TOOLKIT_VERSION_<TOOLKIT_SLUG>`` environment variable
       (slug compared case-insensitively). Fall back to ``'latest'`` if not
       set.

    :param toolkit_slug: The slug/name of the toolkit to get the version for
                         (e.g. ``'github'``, ``'slack'``).
    :param toolkit_versions: Optional toolkit versions configuration:

        - A ``str`` — used as a global version for every toolkit.
        - A ``dict`` mapping toolkit slugs to version strings.
        - ``None`` — environment variables are consulted as a fallback.

    :returns: The resolved toolkit version string (e.g. ``'20250902_00'``),
              or ``'latest'`` if no version is configured.
    """
    # A string value applies globally to all toolkits.
    if isinstance(toolkit_versions, str):
        return toolkit_versions

    # A dict mapping provides per-toolkit overrides.
    if isinstance(toolkit_versions, dict) and len(toolkit_versions) > 0:
        return toolkit_versions.get(toolkit_slug, "latest")

    # No explicit config: fall back to environment variables so that
    # COMPOSIO_TOOLKIT_VERSION_<SLUG> is honoured even when toolkit_versions
    # is None (consistent with get_toolkit_versions() behaviour).
    env_versions = _get_toolkit_versions_from_env()
    return env_versions.get(toolkit_slug.lower(), "latest")


def get_toolkit_versions(
    default_versions: t.Optional[ToolkitVersionParam] = None,
) -> ToolkitVersionParam:
    """
    Build the full toolkit-versions configuration used by the SDK client.

    Merges environment variables with a caller-supplied mapping so that env
    vars can be overridden per-toolkit while still serving as a base for
    toolkits that are not explicitly mentioned in the caller's config.

    Priority order (highest to lowest):

    1. If *default_versions* is a ``str``, return it immediately—it applies
       as a global version for all toolkits and overrides everything else.
    2. Caller-supplied ``dict`` values override per-toolkit env vars.
    3. ``COMPOSIO_TOOLKIT_VERSION_<TOOLKIT_NAME>`` environment variables
       provide per-toolkit defaults.
    4. ``'latest'`` is returned when no versions are configured at all.

    :param default_versions: Optional default versions configuration:

        - A ``str`` — returned as-is (global version override).
        - A ``dict`` mapping toolkit slugs to version strings.
        - ``None`` — only environment variables (and the ``'latest'``
          fallback) are used.

    :returns: A ``str`` for a global version, a ``dict`` for per-toolkit
              versions, or ``'latest'`` when nothing is configured.
    """
    # If already set by user as a string, use it as global version for all toolkits
    if isinstance(default_versions, str):
        return default_versions

    # Check if there are envs similar to COMPOSIO_TOOLKIT_VERSION_GITHUB then extract the toolkit name
    toolkit_versions_from_env = _get_toolkit_versions_from_env()

    # If the provided default versions is a dict, normalize the keys to be lower case
    # Use user provided values as overrides
    user_provided_toolkit_versions: ToolkitVersions = {}
    if default_versions and isinstance(default_versions, dict):
        user_provided_toolkit_versions = {
            key.lower(): value for key, value in default_versions.items()
        }

    # Final toolkit versions
    toolkit_versions = {
        **toolkit_versions_from_env,
        **user_provided_toolkit_versions,
    }

    # If the toolkit_versions are empty, use 'latest'
    if len(toolkit_versions) == 0:
        return "latest"

    return toolkit_versions
