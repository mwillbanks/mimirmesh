# Implementation Plan: Remove Codebase-Memory MCP Engine

**Branch**: `005-remove-codebase-memory` | **Date**: 2026-03-18 | **Spec**: `/docs/specifications/005-remove-codebase-memory/spec.md`
**Input**: Feature specification from `/docs/specifications/005-remove-codebase-memory/spec.md`

## Summary

Retire `codebase-memory-mcp` as an active engine across configuration, adapter registration, runtime compose/orchestration, CLI engine toggles, and documentation, while preserving Srclight as the single code-intelligence engine. Provide one-time legacy config migration with persisted write-back, explicit failure on write errors, no automatic backup files, and precedence rules that preserve explicit Srclight values.

## Technical Context

**Language/Version**: TypeScript 5.9 on Bun workspace  
**Primary Dependencies**: Bun, Zod (`@mimirmesh/config`), MCP SDK (`@modelcontextprotocol/sdk`), Ink/Pastel for CLI surfaces  
**Storage**: Project YAML config (`.mimirmesh/config.yml`) and runtime state files under `.mimirmesh/runtime/`  
**Testing**: `bun test` package tests and root integration/workflow tests (`tests/integration`, `tests/workflow`)  
**Target Platform**: macOS/Linux developer hosts with Docker Compose for runtime orchestration  
**Project Type**: Bun workspace monorepo (CLI + runtime + shared packages)  
**Performance Goals**: No regression in runtime startup/readiness behavior; compose topology reduced by one retired service  
**Constraints**: One-time migration write-back only, no automatic backup artifacts, explicit Srclight precedence on overlap, live-discovery truthfulness retained  
**Scale/Scope**: Cross-package retirement touching config, runtime, adapters, CLI command surfaces, tests, and feature docs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate Check

- [x] Live discovery gate: Retirement removes a retired engine; routing/discovery for active engines remains live-discovered.
- [x] Upstream runtime gate: Runtime continues to execute real upstream containers for remaining engines.
- [x] Readiness gate: Plan preserves bootstrap/readiness verification while removing retired branches.
- [x] Degraded truth gate: Failure paths (including migration write failure) are explicit and execution-validated.
- [x] Local-first gate: No hosted fallback behavior is introduced by this feature.
- [x] Monorepo boundary gate: Changes are scoped to existing `packages/*`, `apps/*`, and docs locations.
- [x] Modularity gate: Retirement removes branches/modules rather than introducing new junk-drawer abstractions.
- [x] CLI experience gate: CLI engine toggles remain consistent with supported engines.
- [x] Testing gate: Plan includes package-local and root regression updates for retirement + migration behavior.
- [x] Documentation gate: Runtime/MCP feature docs are updated to match observed post-retirement behavior.

### Post-Design Re-Check

- [x] Research decisions enforce deterministic migration semantics and runtime truth.
- [x] Data model captures engine catalog retirement, one-time migration, precedence, and failure contracts.
- [x] Contracts specify migration and runtime-surface invariants that map directly to tests.
- [x] Quickstart covers validation flows for schema/defaults, migration idempotence, runtime topology, and docs/test parity.

## Project Structure

### Documentation (this feature)

```text
docs/specifications/005-remove-codebase-memory/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── engine-retirement-surface.md
│   └── legacy-config-migration.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
└── cli/
  └── src/commands/config/
    ├── enable.tsx
    └── disable.tsx

packages/
├── config/
│   ├── src/schema/index.ts
│   ├── src/defaults/index.ts
│   └── src/readers/index.ts
├── mcp-adapters/
│   ├── src/index.ts
│   └── codebase-memory-mcp/               # candidate removal
├── runtime/
│   ├── src/compose/generate.ts
│   ├── src/services/runtime-lifecycle.ts
│   └── tests/
├── mcp-core/
│   └── tests/
└── testing/
  └── src/fixtures/runtime-upgrade.ts

docker/
└── images/
  └── codebase-memory/                   # candidate removal

tests/
└── integration/
  └── engines.test.ts

docs/
├── features/
│   ├── mcp-client.md
│   └── mcp-server.md
└── operations/
  └── runtime.md
```

**Structure Decision**: Use existing monorepo package boundaries and remove retired-engine surfaces in place. No new packages or app entry points are introduced.

## Complexity Tracking

No constitution violations requiring justification.
