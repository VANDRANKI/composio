# Python SDK Development Notes

Notes specific to developing the Composio Python SDK located in `python/`.
For the full TypeScript SDK guide see the root `CLAUDE.md`.

## Quick Setup

```bash
cd python
make env              # Creates .venv with all dependencies
source .venv/bin/activate
```

## Common Commands

| Command | Description |
|---------|-------------|
| `make env` | Create virtual environment and install all deps |
| `make sync` | Re-sync deps in an existing environment |
| `make fmt` | Format code with Ruff |
| `make chk` | Run Ruff linter and mypy type checker |
| `nox -s fix` | Auto-fix lint issues |
| `make tst` | Run test suite |
| `make build` | Build distribution packages |

## Test Markers

Tests are tagged with pytest markers to allow targeted runs:

```bash
pytest -m core        # Core SDK tests only
pytest -m openai      # OpenAI provider tests
pytest -m langchain   # LangChain integration tests
pytest -m agno        # Agno integration tests
```

## Type Checking

The SDK uses mypy with strict optional typing configured in `config/mypy.ini`.
Run `make chk` before every commit.

```bash
# Type check a specific module
mypy composio/client/ --config-file config/mypy.ini
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `COMPOSIO_API_KEY` | Yes | Your Composio API key |
| `COMPOSIO_BASE_URL` | No | Override the default API base URL |
| `COMPOSIO_LOG_LEVEL` | No | `silent`, `error`, `warn`, `info`, `debug` |
| `COMPOSIO_DISABLE_TELEMETRY` | No | Set to `"true"` to opt out of telemetry |
| `OPENAI_API_KEY` | For OpenAI tests | OpenAI API key |

## Adding a New Provider

1. Create `providers/<name>/` with `__init__.py` and `provider.py`.
2. Inherit from the appropriate base class in `composio/provider/`.
3. Register in `composio/provider/__init__.py`.
4. Add tests with the `pytest.mark.<name>` marker.
5. Update `noxfile.py` if the provider needs its own nox session.

## Code Quality Checklist

- [ ] `make fmt` applied (Ruff formatter, 88-char line length)
- [ ] `make chk` passes (Ruff linter + mypy)
- [ ] Tests added with appropriate markers
- [ ] Docstrings on all public classes and methods
- [ ] `COMPOSIO_API_KEY` not hardcoded in any test file
