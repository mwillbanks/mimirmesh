# Implementation Plan: Token Reduction via Lazy Tool Registration and Schema Compression

**Branch**: `009-lazy-schema-compression` | **Date**: 2026-03-25 | **Spec**: `/Volumes/Projects/mimirmesh/docs/specifications/009-lazy-schema-compression/spec.md`
**Input**: Feature specification from `/Volumes/Projects/mimirmesh/docs/specifications/009-lazy-schema-compression/spec.md`

## Summary

Add a hybrid MCP-compatible token reduction layer that keeps core unified tools plus required management tools immediately available, lazily exposes passthrough engine groups per session, compresses tool metadata using an Atlassian `mcp-compressor`-style summary approach, emits standard tool-list-changed notifications for refresh, and updates CLI/runtime/config surfaces so operators can inspect deferred groups, load them explicitly, validate startup readiness gating, and validate session-scoped routing behavior. Delivery is governed by `agent-execution-mode` in `hardening`, followed by mandatory `agentic-self-review`, with `code-discipline`, `repo-standards-enforcement`, `mm-unit-testing`, and `biome-enforcement` encoded as required execution skills.

## Technical Context

**Language/Version**: TypeScript 6.0.2 on Bun 1.3.x  
**Primary Dependencies**: `@modelcontextprotocol/sdk` 1.27.1, Zod 4.3.x, Pastel 4, Ink 6, `@inkjs/ui` 2, workspace packages `@mimirmesh/mcp-core`, `@mimirmesh/runtime`, `@mimirmesh/config`, `@mimirmesh/mcp-adapters`, `@mimirmesh/ui`, `@mimirmesh/logging`  
**Storage**: Repository-local config and runtime state under `.mimirmesh/`, persisted runtime routing/engine state files, and per-process in-memory session tool surfaces for MCP server sessions  
**Testing**: `bun test` for package/app coverage, targeted package tests for `packages/mcp-core`, `packages/runtime`, and `packages/config`, CLI workflow tests under `apps/cli/tests/**`, workflow/integration regressions under `tests/workflow/**` and `tests/integration/**`, plus final Biome enforcement  
**Target Platform**: Local stdio MCP server and terminal CLI on macOS/Linux developer and CI environments  
**Project Type**: Bun workspace monorepo with compiled server app, CLI app, and shared packages  
**Performance Goals**: At least 35% default tool/schema token reduction, at least 40% compressed schema reduction for representative inventories, lazy-load completion under 2 seconds for typical engine groups, refreshed policy/tool surfaces visible within 5 seconds  
**Constraints**: Preserve standard MCP SDK compatibility; no custom wire protocol; no hard-coded passthrough inventories; lazy-loaded engine groups are session-scoped; config updates apply live to future operations but loaded groups refresh explicitly; CLI changes must use shared workflow state and visible progress; machine-readable output is required for read-oriented inspection commands in scope (`mimirmesh mcp list-tools`, `mimirmesh mcp tool-schema`, and `mimirmesh status`) while interactive load/config mutation flows remain human-first; implementation must follow `agent-execution-mode` hardening plus post-completion `agentic-self-review`, `code-discipline`, `repo-standards-enforcement`, `mm-unit-testing`, and `biome-enforcement`  
**Scale/Scope**: Changes span `apps/server` tool registration, `packages/mcp-core` routing/registry behavior, `packages/runtime` discovery and session diagnostics, `packages/config` schema/defaults, `apps/cli` MCP workflows/commands, plus docs and regression tests across 3 engine adapters and 50+ potential tools

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Live discovery gate: Deferred passthrough groups will still be discovered from live runtime bridge endpoints and session overlays will be built from live routing state, not static tool catalogs.
- [x] Upstream runtime gate: The feature does not emulate engines; it reuses existing runtime discovery, adapter translation, and bridge health checks against real upstream-backed containers/processes.
- [x] Readiness gate: Core tool readiness and deferred-engine availability remain tied to runtime bootstrap/discovery truth, and startup health is withheld until core discovery succeeds and status output can surface loaded/deferred session state plus health evidence.
- [x] Degraded truth gate: Lazy-load failures, offline requests, and refresh issues are planned as explicit degraded or failed outcomes with root-cause diagnostics from live discovery attempts.
- [x] Local-first gate: No hosted fallback is introduced; the feature remains project-local and runtime-backed.
- [x] Monorepo boundary gate: Server entrypoints stay in `apps/server`; reusable compression, session-surface, config, and routing logic stay in shared packages.
- [x] Modularity gate: The design avoids pushing session registry, compression policy, and notification behavior into `start-server.ts` by separating them into package-level concerns.
- [x] CLI experience gate: CLI work will reuse Pastel, Ink, `@inkjs/ui`, and shared workflow state with visible progress, deferred/core distinction, compressed/full schema views, and explicit machine-readable output for read-oriented inspection commands.
- [x] Testing gate: The plan includes package-local tests for config/router/runtime behavior and root/CLI regressions for session isolation, notifications, tool loading, and operator flows using `mm-unit-testing` rules.
- [x] Documentation gate: The plan includes `docs/features/*` updates covering observed lazy loading, compression behavior, configuration policy, degraded modes, diagnostics, and validation evidence.

**Post-Design Re-check**: PASS. The design artifacts keep discovery live and truthful, isolate reusable logic in shared packages, preserve CLI quality requirements, and encode the requested execution-skill workflow directly in spec, plan, quickstart, and contract obligations.

## Project Structure

### Documentation (this feature)

```text
/Volumes/Projects/mimirmesh/docs/specifications/009-lazy-schema-compression/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── mcp-tool-surface.md
└── tasks.md
```

### Source Code (repository root)

```text
/Volumes/Projects/mimirmesh/apps/server/
├── src/
│   ├── startup/
│   │   └── start-server.ts
│   ├── tools/
│   │   ├── passthrough/
│   │   └── unified/
│   └── middleware/

/Volumes/Projects/mimirmesh/apps/cli/
├── src/
│   ├── commands/mcp/
│   ├── workflows/
│   ├── lib/
│   └── ui/
└── tests/

/Volumes/Projects/mimirmesh/packages/mcp-core/
├── src/
│   ├── registry/
│   ├── routing/
│   ├── discovery/
│   ├── passthrough/
│   └── types/
└── tests/

/Volumes/Projects/mimirmesh/packages/runtime/
├── src/
│   ├── discovery/
│   ├── services/
│   ├── state/
│   └── types/
└── tests/

/Volumes/Projects/mimirmesh/packages/config/
├── src/
│   ├── schema/
│   ├── defaults/
│   ├── readers/
│   ├── writers/
│   └── mutations/
└── tests/

/Volumes/Projects/mimirmesh/packages/mcp-adapters/
├── src/
├── srclight/
├── document-mcp/
└── mcp-adr-analysis-server/

/Volumes/Projects/mimirmesh/tests/
├── integration/
└── workflow/

/Volumes/Projects/mimirmesh/docs/
├── features/
├── operations/
└── specifications/
```

**Structure Decision**: Keep MCP server bootstrap and transport wiring in `apps/server`, but place compression policy, session-scoped tool-surface management, schema summary formatting, and lazy-load orchestration in shared packages, primarily `packages/mcp-core`, with persisted diagnostics and live-discovery coordination in `packages/runtime` and schema/default changes in `packages/config`. CLI presentation and prompting remain in `apps/cli`, reusing existing workflow components instead of creating parallel command-specific state.

## Implementation Notes

- Execution is explicitly governed by `agent-execution-mode` in `hardening`; the implementation closeout must run `agent-execution-mode` in `agentic-self-review` after claiming completion.
- `code-discipline` applies to compression/session registry work: prefer extending current router/runtime/state primitives over inventing thin wrappers or duplicate helpers.
- `repo-standards-enforcement` governs Bun-native validation flow, TypeScript safety, repo boundaries, and docs/test alignment.
- `mm-unit-testing` governs mocking of `.mimirmesh`, runtime state files, Docker/bridge health, and session diagnostics so regular tests stay CI-safe.
- `biome-enforcement` remains the final remediation pass using the required changed-files JSON command, followed by revalidation when Biome edits files.
- Runtime validation must explicitly cover startup readiness gating and structured lazy-load logging with timestamps, engine names, tool counts, and success/failure status.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
