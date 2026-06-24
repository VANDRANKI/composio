# TypeScript SDK Development Notes

Notes for contributors working on the Composio TypeScript SDK in `ts/`.
For the full overview see the root `CLAUDE.md`.

## Setup

```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Watch mode for active development
pnpm --filter @composio/core build --watch
```

## Package Graph

```
@composio/core          ← foundation, all others depend on this
├── @composio/openai
├── @composio/anthropic
├── @composio/google
├── @composio/langchain
├── @composio/vercel
├── @composio/mastra
└── @composio/cli
```

Changes to `@composio/core` may require rebuilding all dependents:
```bash
pnpm build:packages
```

## Running Tests

```bash
# Unit tests (all packages)
pnpm test

# Core package only
cd ts/packages/core && pnpm test

# E2E tests (requires Docker)
pnpm test:e2e:node    # Node.js CJS + ESM
pnpm test:e2e:deno    # Deno npm: specifier compat
```

## Code Quality

```bash
# Lint
pnpm lint

# Fix lint issues
pnpm lint:fix

# Format (Prettier)
pnpm format
```

## Adding a New Provider

```bash
# Scaffold a new provider package
pnpm create:provider <name>          # standard
pnpm create:provider <name> --agentic  # with execution handlers
```

Then implement:
1. `wrapTool(tool)` — wrap a single tool for the target framework
2. `wrapTools(tools)` — wrap an array of tools
3. (Agentic only) execution handler that routes tool calls back to Composio

See `ts/packages/openai/` for a reference implementation.

## Releasing

```bash
# Create a changeset for your changes
pnpm changeset

# Preview the version bump
pnpm changeset:version

# Publish (CI does this automatically on merge)
pnpm changeset:release
```

## Important Conventions

- TypeScript strict mode is enabled — avoid `any` types.
- All public APIs need TSDoc comments.
- The `ts/vendor/` directory is read-only reference code; never modify it.
- Husky pre-commit hooks run lint and format checks automatically.
