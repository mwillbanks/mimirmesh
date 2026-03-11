# Implementation Plan: Srclight Runtime Replacement

**Branch**: `001-local-code-intelligence` | **Date**: 2026-03-13 | **Spec**: `/Volumes/Projects/mimirmesh/docs/specifications/001-local-code-intelligence/spec.md`
**Input**: Feature specification from `/docs/specifications/001-local-code-intelligence/spec.md`

## Summary

Replace the optional `codebrain` runtime engine with a real Srclight workload and make Srclight the preferred code-intelligence engine for unified code tools. The implementation uses a real Python container under `docker/images/srclight`, extends the bridge to support upstream HTTP transports so Srclight can run as a warm SSE service inside the container, adds command-based bootstrap so MímirMesh runs native `srclight index` during readiness, preserves live passthrough discovery, and updates runtime health/docs/tests to reflect real Srclight behavior with optional local Ollama embeddings.

## Technical Context

**Language/Version**: TypeScript on Bun for MímirMesh packages and Python 3.12 for the Srclight container workload  
**Primary Dependencies**: `@modelcontextprotocol/sdk`, Bun workspace packages, Docker Compose runtime, Srclight `0.12.x`, SQLite FTS5, tree-sitter, optional Ollama embeddings  
**Storage**: Project-local runtime state under `.mimirmesh/runtime/*`, engine state JSON under `.mimirmesh/runtime/engines/*`, and native Srclight repo-local `.srclight/` index artifacts inside the mounted repository  
**Testing**: `bun test` package-local tests, runtime integration tests in `packages/testing`, root workflow tests in `tests/workflow`, and doc/runtime validation flows  
**Target Platform**: Project-scoped Docker runtime on macOS/Linux hosts with Linux containers  
**Project Type**: Bun workspace monorepo with CLI app, MCP server/client apps, reusable packages, and containerized engine integrations  
**Performance Goals**: Truthful readiness only after indexing completes; 95% of representative unified or passthrough code-intelligence queries return usable results within 10 seconds; warm code search should avoid per-request cold-start penalties  
**Constraints**: Default operation must remain fully local with no hosted API keys, dynamic discovery must stay live-driven, degraded mode must remain evidence-based, embeddings must be optional, and reusable logic must stay in `packages/*`  
**Scale/Scope**: One active repository per MímirMesh runtime with a warm Srclight SSE server, roughly 20-30 discovered Srclight tools, existing unified code-intelligence tools rerouted to Srclight when capability matches exist, and package/root tests covering image build through workflow validation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Live discovery gate: Srclight passthrough tools remain sourced from bridge discovery, and unified routes resolve only from discovered Srclight capabilities.
- [x] Upstream runtime gate: The design runs real `srclight serve` and `srclight index` commands in a Python container rather than a placeholder wrapper.
- [x] Readiness gate: Bootstrap expands beyond tool calls so native `srclight index` completion becomes a readiness prerequisite.
- [x] Degraded truth gate: Base engine health, index health, and optional embedding health are separated so degraded reports point to the real failing capability.
- [x] Local-first gate: Base operation is local-only by default; embeddings use local Ollama only when configured, and hosted providers are not part of the default implementation.
- [x] Monorepo boundary gate: Adapter, runtime, config, and testing changes stay in package-owned areas; CLI changes remain in `apps/cli` only for engine toggles.
- [x] Modularity gate: Srclight gets its own adapter package folder, while bridge transport changes and bootstrap-mode changes stay isolated in runtime services/types.
- [x] Testing gate: Plan includes package-local tests for config/adapter/runtime code plus integration and workflow coverage for build, startup, discovery, bootstrap, routing, and degraded behavior.
- [x] Documentation gate: `docs/features/mcp-server.md` and `docs/features/mcp-client.md` are explicit deliverables derived from live Srclight validation.

## Project Structure

### Documentation (this feature)

```text
docs/specifications/001-local-code-intelligence/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── srclight-runtime.md
│   └── srclight-routing.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
└── cli/
  └── src/
    └── commands/
      └── config/

docker/
└── images/
  ├── common/
  └── srclight/

packages/
├── config/
│   └── src/
│       ├── defaults/
│       └── schema/
├── mcp-adapters/
│   ├── src/
│   └── srclight/
│       └── src/
├── mcp-core/
│   └── src/
│       ├── registry/
│       ├── routing/
│       └── types/
├── runtime/
│   └── src/
│       ├── bootstrap/
│       ├── discovery/
│       ├── images/
│       ├── services/
│       └── state/
└── testing/
  └── src/
    └── integration/

tests/
└── workflow/

docs/
└── features/
  ├── mcp-client.md
  └── mcp-server.md
```

**Structure Decision**: This feature stays inside the existing monorepo boundaries: checked-in engine image assets under `docker/images/srclight`, reusable runtime/config/adapter logic under `packages/*`, CLI engine-toggle updates in `apps/cli`, runtime-facing documentation in `docs/features`, and regression coverage split between package-local integration tests and root workflow tests.

## Complexity Tracking

No constitution violations require justification for this plan.

## Phase 0 Research Output

- See `/Volumes/Projects/mimirmesh/docs/specifications/001-local-code-intelligence/research.md`.

## Phase 1 Design Output

- Data model: `/Volumes/Projects/mimirmesh/docs/specifications/001-local-code-intelligence/data-model.md`
- Runtime contract: `/Volumes/Projects/mimirmesh/docs/specifications/001-local-code-intelligence/contracts/srclight-runtime.md`
- Routing contract: `/Volumes/Projects/mimirmesh/docs/specifications/001-local-code-intelligence/contracts/srclight-routing.md`
- Validation quickstart: `/Volumes/Projects/mimirmesh/docs/specifications/001-local-code-intelligence/quickstart.md`
