# Composio SDK Development Guide

This repository contains both a TypeScript SDK (`ts/`) and a Python SDK
(`python/`). Most active development targets the TypeScript SDK.

## TypeScript SDK

### Requirements

- Node.js (see `.nvmrc`)
- pnpm (see `package.json` `packageManager` field)
- Bun (see `.bun-version`) for certain scripts

### Setup

```bash
pnpm install
```

### Build

```bash
pnpm build              # all packages
pnpm build:packages     # only TS packages (faster)
```

### Test

```bash
pnpm test

# Single package
cd ts/packages/core && pnpm test
```

### Lint & Format

```bash
pnpm lint
pnpm lint:fix
pnpm format
```

### Adding a New Provider

```bash
pnpm create:provider <provider-name>
# for agentic providers:
pnpm create:provider <provider-name> --agentic
```

Then implement `wrapTool` and `wrapTools` (and for agentic providers,
the execution handler). See `ts/packages/providers/openai/` for a
complete example.

## Python SDK

### Setup

```bash
cd python
make env                  # creates .venv
source .venv/bin/activate
```

### Test

```bash
make tst
# or
nox -s tst

# By marker
pytest -m core
pytest -m openai
```

### Lint & Format

```bash
make fmt   # ruff format
make chk   # ruff check + mypy
```

## Environment Variables

```bash
COMPOSIO_API_KEY          # Required for live tests
COMPOSIO_BASE_URL         # Optional: override API base
COMPOSIO_LOG_LEVEL        # silent|error|warn|info|debug
COMPOSIO_DISABLE_TELEMETRY=true   # opt out of telemetry
```

## Changesets

For any user-facing change, create a changeset before opening a PR:

```bash
pnpm changeset
# follow prompts to describe the change and select affected packages
```

## Commit Convention

```
feat(core): add modifier pipeline for tool output transformation
fix(openai): handle parallel tool call responses correctly
docs(anthropic): add streaming usage example
test(core): add coverage for ConnectedAccount.refresh
```
