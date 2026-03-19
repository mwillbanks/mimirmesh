# Contributing to MimirMesh

Thanks for contributing.

## Project Status

MimirMesh is in early alpha. Breaking changes and internal refactors are expected while we harden the platform.

## Before You Start

1. Search existing issues and roadmap items.
2. For new features or cross-cutting changes, align with the Spec Kit workflow under `docs/specifications/`.
3. Keep changes minimal, explicit, and aligned to existing architecture.

## Local Setup

```bash
bun install
bun run build
```

Optional local binary install:

```bash
MIMIRMESH_INSTALL_DIR="$HOME/.local/bin" bun run scripts/install.ts
```

## Development Rules

- Use Bun workspace tooling only.
- Keep reusable logic in `packages/*`, not `apps/*`.
- Preserve CLI UX quality (Pastel + Ink + `@inkjs/ui`).
- Use the official MCP TypeScript SDK.
- Keep runtime state project-scoped under `.mimirmesh/`.
- Update docs when behavior changes.

## Testing and Validation

Run these before opening a PR:

```bash
bun run typecheck
bun run test
bun run build
```

Integration test workflows may require Docker support not available in all CI environments. When needed, skip runtime-heavy integration in constrained environments:

```bash
MIMIRMESH_RUN_INTEGRATION_TESTS=false bun run scripts/run-integration-tests.ts
```

## Formatting and Linting

Run Biome as the final enforcement pass for changed files:

```bash
bunx @biomejs/biome check --write --unsafe --changed --no-errors-on-unmatched --files-ignore-unknown=true --reporter=json
```

## Pull Request Checklist

1. Link the relevant issue/specification.
2. Explain user-visible and operational impact.
3. Include tests for changed behavior.
4. Update docs (`README.md`, `docs/features/`, runbooks, or roadmap) when needed.
5. Confirm local validation commands pass.

## Commit Messages

Use conventional-style commit messages where possible (for example: `feat:`, `fix:`, `docs:`, `chore:`).

## Security

Do not commit secrets, tokens, or private credentials. Runtime logs and diagnostics must not expose secrets.

## Code of Conduct

By participating, you agree to collaborate respectfully and constructively.
