# Composio Development Guide

This document covers the monorepo layout, environment setup for both TypeScript and Python stacks, and key workflows for contributors.

---

## Repository Structure

```
composio/
├── ts/                        # TypeScript SDK (primary development target)
│   ├── packages/
│   │   ├── core/              # @composio/core — main SDK logic
│   │   ├── providers/         # AI provider integrations (openai, anthropic, etc.)
│   │   ├── cli/               # @composio/cli — command-line interface (Effect.ts)
│   │   ├── json-schema-to-zod/ # Schema conversion utility
│   │   └── ts-builders/       # TypeScript code-generation utilities
│   ├── examples/              # Usage examples keyed by provider
│   ├── e2e-tests/             # Runtime compatibility tests (Node, Deno, Cloudflare)
│   └── vendor/                # Read-only git submodules (Effect, Clack) — do not edit
├── python/                    # Python SDK
│   ├── composio/              # Main Python package
│   ├── providers/             # Python provider implementations
│   ├── tests/                 # Pytest test suite
│   └── noxfile.py             # Nox automation sessions
├── docs/                      # Documentation (Fumadocs)
└── .github/                   # CI/CD workflows
```

---

## TypeScript Setup

### Prerequisites

- Node.js (latest LTS)
- [pnpm](https://pnpm.io/) v10.8.0 or later
- [bun](https://bun.sh) (optional, for some scripts)

### Install and Build

```bash
# Install all workspace dependencies
pnpm install

# Build all packages (uses Turbo)
pnpm build

# Build only the packages (skip examples/docs)
pnpm build:packages

# Clean all build artifacts
pnpm clean
```

### Running Tests

```bash
# Run all unit tests
pnpm test

# Run tests for a single package
cd ts/packages/core && pnpm test

# Run tests with the Vitest UI
pnpm test:ui

# Run Node.js e2e compatibility tests (requires Docker)
pnpm test:e2e:node

# Run Deno e2e tests (requires Docker)
pnpm test:e2e:deno

# Run Cloudflare Workers e2e tests
pnpm test:e2e:cloudflare
```

### Linting and Formatting

```bash
pnpm lint          # ESLint
pnpm lint:fix      # ESLint with auto-fix
pnpm format        # Prettier
```

---

## Python Setup

The Python SDK lives in `python/` and uses [uv](https://github.com/astral-sh/uv) for dependency management and [nox](https://nox.thea.codes/) for task automation.

### Prerequisites

- Python 3.10 or later
- [uv](https://github.com/astral-sh/uv)

### Install and Build

```bash
cd python

# Create virtual environment and install all dependencies
make env
source .venv/bin/activate

# Sync dependencies in an existing environment
make sync

# Install provider packages
make provider
```

### Running Tests

```bash
cd python

# Run all tests
make tst

# Run tests for a specific marker
pytest -m core
pytest -m openai
pytest -m langchain
pytest -m agno
```

### Linting and Formatting

```bash
cd python

# Format with Ruff
make fmt

# Check lint and type issues (Ruff + mypy)
make chk

# Auto-fix lint issues
nox -s fix
```

---

## Creating a New TypeScript Provider

Use the scaffolding script to bootstrap a new provider package:

```bash
# Non-agentic provider (wrapTool + wrapTools)
pnpm create:provider my-provider

# Agentic provider (also adds execution handlers)
pnpm create:provider my-provider --agentic
```

This generates a new package under `ts/packages/providers/my-provider/` with the correct structure, tsconfig, and package.json. After scaffolding:

1. Implement `wrapTool()` and `wrapTools()` (and execution handlers for agentic providers).
2. Add unit and integration tests under the package's `test/` directory.
3. Add an example under `ts/examples/my-provider/`.
4. Update peer dependencies with `pnpm update:peer-deps`.

---

## Vendor Submodules (Read-Only)

The `ts/vendor/` directory contains read-only git submodules for reference:

| Path | Source | Purpose |
|------|--------|---------|
| `ts/vendor/effect/` | [Effect-TS/effect](https://github.com/Effect-TS/effect) | Effect runtime and `@effect/cli` patterns for the CLI package |
| `ts/vendor/clack/` | [bombshell-dev/clack](https://github.com/bombshell-dev/clack) | `@clack/prompts` API reference for terminal UI |

**Do not modify files under `ts/vendor/`.** These directories are for reading source, not editing. The actual dependencies are resolved via `pnpm install` from npm.

---

## Environment Variables

```bash
COMPOSIO_API_KEY              # Required: your Composio API key
COMPOSIO_BASE_URL             # Optional: custom API base URL (for self-hosted)
COMPOSIO_LOG_LEVEL            # Optional: silent | error | warn | info | debug
COMPOSIO_DISABLE_TELEMETRY    # Optional: set to "true" to disable telemetry
OPENAI_API_KEY                # Required for OpenAI provider examples
```

---

## Common Scripts Reference

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all TS dependencies |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all TS unit tests |
| `pnpm lint` | Lint TS code |
| `pnpm format` | Format TS code |
| `pnpm create:provider <name>` | Scaffold a new provider |
| `pnpm create:example <name>` | Scaffold a new example |
| `pnpm changeset` | Create a changeset for a release |
| `cd python && make env` | Set up Python virtual environment |
| `cd python && make tst` | Run Python tests |
| `cd python && make chk` | Lint and type-check Python code |
