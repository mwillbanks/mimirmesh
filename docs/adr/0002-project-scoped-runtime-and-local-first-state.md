# ADR 0002: Project-Scoped Runtime and Local-First State

- Status: Accepted
- Date: 2026-03-12
- Sources: `INITIAL_SPEC.md`, `docs/operations/runtime.md`, `README.md`

## Context

MímirMesh is intended to be local-first and safe to use across many repositories without requiring global mutable runtime state. The implementation specification requires per-project configuration, runtime metadata, logs, reports, templates, and indexes under `.mimirmesh/`.

The platform also needs to support safe cleanup, reproducible first-run behavior, and clear isolation between repositories.

## Decision

MímirMesh treats `.mimirmesh/` as the authoritative project-scoped control plane.

The repository-local state model includes:

- `.mimirmesh/config.yml` for validated project configuration
- `.mimirmesh/runtime/` for compose, health, routing, bootstrap, and connection state
- `.mimirmesh/logs/` for error and session logs
- `.mimirmesh/indexes/`, `.mimirmesh/reports/`, `.mimirmesh/templates/`, `.mimirmesh/memory/`, and `.mimirmesh/cache/` for the remaining local platform state

Runtime orchestration is also project-scoped. Docker Compose projects, container naming, mounts, and runtime metadata are derived from the active repository rather than from any global installation state.

## Consequences

Positive:

- repositories remain isolated from each other
- cleanup and rebuild operations are bounded to one project
- agent workflows can rely on a predictable local control directory
- diagnostics remain inspectable without requiring external services

Tradeoffs:

- initialization work repeats per repository
- runtime metadata and logs must be maintained carefully to avoid stale local state
