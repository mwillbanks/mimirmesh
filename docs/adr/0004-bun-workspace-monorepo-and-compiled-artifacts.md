# ADR 0004: Bun Workspace Monorepo and Compiled Artifacts

- Status: Accepted
- Date: 2026-03-12
- Sources: `INITIAL_SPEC.md`, `README.md`, `docs/architecture/overview.md`

## Context

MímirMesh is composed of multiple runnable applications and a shared package surface. The implementation specification requires a Bun workspace monorepo, TypeScript, clear app/package boundaries, and single-file build artifacts that can be installed locally.

This needs to support:

- a CLI
- an MCP server
- an MCP client
- reusable packages for config, runtime, routing, adapters, reports, templates, logging, and workspace analysis

## Decision

MímirMesh is implemented as a Bun workspace monorepo with:

- `apps/cli`, `apps/server`, and `apps/client` as runnable applications
- `packages/*` as the only place for shared reusable logic
- Bun as the package manager, workspace manager, runtime where appropriate, and compiled build tool
- compiled artifacts for `mimirmesh`, `mm`, `mimirmesh-server`, and `mimirmesh-client`

The repository explicitly avoids placing reusable logic in application folders and relies on package boundaries to keep architecture legible.

## Consequences

Positive:

- shared functionality stays reusable and testable
- local installation can be validated from produced artifacts
- build and runtime expectations remain consistent across applications

Tradeoffs:

- workspace discipline is required to prevent app-local shortcuts from leaking into production paths
- compiled-mode execution needs repository-aware fallbacks where filesystem scanning is not available at runtime
