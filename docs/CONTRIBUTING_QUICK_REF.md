# Composio SDK Contributor Quick Reference

## TypeScript SDK setup

```bash
cd ts/
pnpm install
pnpm build
pnpm test
```

## Python SDK setup

```bash
cd python/
make env
source .venv/bin/activate
make chk   # lint + type check
make tst   # run tests
```

## Adding a new AI provider package (TypeScript)

```bash
pnpm create:provider my-provider
```

This scaffolds a new package under `ts/packages/providers/my-provider/`.
Implement the `wrapTools(tools)` method, then add tests and update
`ts/README.md`.

## Error handling conventions

Always check `result.successful` before accessing `result.data`:

```typescript
const result = await composio.tools.execute('MY_TOOL', { ... })
if (!result.successful) {
  throw new Error(`Tool execution failed: ${result.error}`)
}
const data = result.data  // safe to access
```

For Python:

```python
result = composio.tools.execute("MY_TOOL", ...)
if not result.successful:
    raise RuntimeError(f"Tool execution failed: {result.error}")
```

## Changeset for releases

```bash
pnpm changeset
# Describe the change for the changelog
pnpm changeset:version
```

## Pre-commit checks

```bash
pnpm lint && pnpm format && pnpm test
```
