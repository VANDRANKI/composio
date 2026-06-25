# Cross-SDK Development Guide

Composio ships both a TypeScript SDK (`ts/`) and a Python SDK (`python/`).
This guide gives contributors a fast-path reference for both environments.

## TypeScript SDK (`ts/`)

### Setup
```bash
pnpm install
pnpm build
```

### Key commands
| Command | Purpose |
|---|---|
| `pnpm build` | Build all packages |
| `pnpm build:packages` | Build TS packages only |
| `pnpm test` | Run all tests (Vitest) |
| `pnpm lint` | ESLint check |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm format` | Prettier formatting |

### Adding a new provider
```bash
# Standard provider
pnpm create:provider my-framework

# Agentic provider (includes execution handler)
pnpm create:provider my-framework --agentic
```

Agentic providers require implementing:
- `wrapTools(tools)` — converts Composio tools to framework format
- An execution handler that calls `composio.tools.execute()`

### Changeset conventions
```bash
pnpm changeset          # create a changeset
pnpm changeset:version  # bump versions
pnpm changeset:release  # publish
```

Always use **patch** bumps for bug fixes and docs. Never create major or
minor bumps without explicit approval from maintainers.

### Package dependency graph
```
@composio/core          <- all providers depend on this
├── @composio/openai
├── @composio/anthropic
├── @composio/google
├── @composio/langchain
├── @composio/vercel
└── @composio/mastra
@composio/cli           <- standalone, depends on @composio/core
```

## Python SDK (`python/`)

### Setup
```bash
cd python
make env              # creates .venv and installs dependencies
source .venv/bin/activate
```

### Key commands
| Command | Purpose |
|---|---|
| `make fmt` / `nox -s fmt` | ruff format |
| `make chk` / `nox -s chk` | ruff check + mypy |
| `make tst` / `nox -s tst` | run tests |
| `make sync` | sync dependencies |

### Test markers
```bash
pytest -m core                # core tests only (no API keys)
pytest -m openai              # OpenAI provider tests
pytest -m langchain           # LangChain provider tests
pytest -m agno                # Agno provider tests
pytest -m "not openai"        # everything except OpenAI
```

### Environment variables
| Variable | Purpose |
|---|---|
| `COMPOSIO_API_KEY` | Required for most tests |
| `COMPOSIO_BASE_URL` | Override API endpoint |
| `COMPOSIO_LOG_LEVEL` | `silent`/`error`/`warn`/`info`/`debug` |
| `COMPOSIO_DISABLE_TELEMETRY` | Set to `true` to disable telemetry |

## Pre-PR checklist

**TypeScript:**
- [ ] `pnpm lint` passes
- [ ] `pnpm format` applied
- [ ] `pnpm test` passes
- [ ] Changeset created (`pnpm changeset`) if user-facing

**Python:**
- [ ] `make fmt` applied
- [ ] `make chk` passes (ruff + mypy)
- [ ] `make tst` passes
- [ ] Version bumped if needed (`make bump`)
