# Tasks: Route-Level Cost Hints with Runtime Telemetry and Adaptive Rollups

**Input**: Design documents from `/docs/specifications/011-route-cost-telemetry/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Tests are required for this feature because the specification explicitly requires validation for migrations, telemetry persistence, rollups, compaction idempotency, adaptive ordering, inspection surfaces, and maintenance workflows.

**Organization**: Tasks are grouped by user story to keep each delivery slice independently testable after the shared prerequisites are complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: User story label for story-specific work only (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Every task includes exact file paths to change or create

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the top-level config and type scaffolding that every telemetry task depends on.

- [X] T001 Add `mcp.routingHints` schema and validation in `packages/config/src/schema/index.ts`
- [X] T002 Add default `mcp.routingHints` values in `packages/config/src/defaults/index.ts`
- [X] T003 [P] Export route-hints config types in `packages/config/src/index.ts`
- [X] T004 [P] Add route telemetry domain types, execution-strategy metadata, and seed-hint runtime models in `packages/runtime/src/types/index.ts`
- [X] T005 [P] Extend routed tool metadata types for seed hints and execution strategy in `packages/mcp-core/src/types/index.ts` and `packages/mcp-adapters/src/types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the reusable telemetry subsystem primitives required before any user-story behavior can be implemented.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T006 Create route telemetry PostgreSQL schema bootstrap in `packages/runtime/src/state/route-telemetry-migrations.ts`
- [X] T007 Create route telemetry state helpers and persistence types in `packages/runtime/src/state/route-telemetry.ts`
- [X] T008 Create Bun.SQL repository methods for events, rollups, snapshots, maintenance state, and scoped clearing in `packages/runtime/src/services/route-telemetry-store.ts`
- [X] T009 [P] Create snapshot derivation primitives in `packages/runtime/src/services/route-hint-snapshots.ts`
- [X] T010 [P] Create telemetry health summarization helpers in `packages/runtime/src/services/route-telemetry-health.ts`
- [X] T011 [P] Create advisory-lock and compaction orchestration service skeleton in `packages/runtime/src/services/route-telemetry-maintenance.ts`
- [X] T012 Wire telemetry exports through `packages/runtime/src/index.ts`
- [X] T013 Add shared route metadata resolution helpers in `packages/mcp-core/src/routing/hints.ts`
- [X] T014 Add sanitized request summary and profile-key helpers in `packages/mcp-core/src/routing/summaries.ts`

**Checkpoint**: The repository now has config, storage, snapshot, and maintenance primitives ready for story work.

---

## Phase 3: User Story 1 - Adaptive Route Choice For Repeated Unified Workflows (Priority: P1) 🎯 MVP

**Goal**: Make `search_code` and `find_symbol` reorder routes from durable hint snapshots while preserving deterministic fallback behavior.

**Independent Test**: Repeated invocations of `search_code` and `find_symbol` can change effective route order once telemetry is sufficient, while sparse or stale history keeps deterministic seeded ordering.

### Tests for User Story 1

- [X] T015 [P] [US1] Add adaptive scoring and tie-break tests in `packages/mcp-core/tests/routing/route-hints.test.ts`
- [X] T016 [P] [US1] Add router regression tests for allowlist gating and deterministic fallback in `packages/mcp-core/tests/registry/router.route-hints.test.ts`
- [X] T017 [P] [US1] Add config override validation tests for `mcp.routingHints.adaptiveSubset` in `packages/config/tests/schema/routing-hints.test.ts`

### Implementation for User Story 1

- [X] T018 [US1] Add seed hints and `fallback-only` strategy metadata for `search_code` and `find_symbol` in `packages/mcp-adapters/srclight/src/routing.ts`
- [X] T019 [US1] Extend shared adapter route resolution to carry seed hints and execution strategy in `packages/mcp-adapters/src/utils.ts`
- [X] T020 [US1] Implement effective allowlist resolution and override filtering in `packages/mcp-core/src/routing/hints.ts`
- [X] T021 [US1] Implement effective-cost scoring, confidence handling, and stable tie-breaks in `packages/mcp-core/src/routing/hints.ts`
- [X] T022 [US1] Update route ordering to consume hint snapshots in `packages/mcp-core/src/routing/table.ts`
- [X] T023 [US1] Instrument unified route attempts, persist telemetry events, and switch eligible tools to ordered fallback execution in `packages/mcp-core/src/registry/router.ts`
- [X] T024 [US1] Persist sanitized argument summaries and request fingerprints during route writes in `packages/runtime/src/services/route-telemetry-store.ts`

**Checkpoint**: `search_code` and `find_symbol` can adapt route order from stored hint state without breaking deterministic fallback.

---

## Phase 4: User Story 2 - Durable Telemetry History Without Unbounded Growth (Priority: P1)

**Goal**: Make route telemetry durable across restarts and bounded over time with rollups, pruning, and periodic maintenance.

**Independent Test**: Raw route events persist across runtime restart, roll up into 15m/6h/1d aggregates, and prune correctly under repeated compaction runs.

### Tests for User Story 2

- [X] T025 [P] [US2] Add migration, raw-event persistence, and sanitized-summary-only storage tests in `packages/runtime/tests/state/route-telemetry-migrations.test.ts`
- [X] T026 [P] [US2] Add rollup, pruning, and idempotency tests in `packages/runtime/tests/services/route-telemetry-maintenance.test.ts`
- [X] T027 [P] [US2] Add runtime lifecycle telemetry-health tests in `packages/runtime/tests/services/runtime-lifecycle.telemetry.test.ts`

### Implementation for User Story 2

- [X] T028 [US2] Implement 15-minute, 6-hour, and 1-day rollup generation in `packages/runtime/src/services/route-telemetry-maintenance.ts`
- [X] T029 [US2] Implement snapshot refresh from rollups and seed hints in `packages/runtime/src/services/route-hint-snapshots.ts`
- [X] T030 [US2] Implement raw-event and rollup pruning rules in `packages/runtime/src/services/route-telemetry-maintenance.ts`
- [X] T031 [US2] Implement maintenance state tracking and lock handling in `packages/runtime/src/services/route-telemetry-maintenance.ts`
- [X] T032 [US2] Add runtime catch-up and telemetry-health reporting in `packages/runtime/src/services/runtime-lifecycle.ts` and `packages/runtime/src/health/state.ts`
- [X] T033 [US2] Start periodic compaction from `apps/server/src/startup/start-server.ts`

**Checkpoint**: Telemetry remains durable and bounded with periodic and on-demand maintenance semantics.

---

## Phase 5: User Story 3 - Explainable Route Hints And Operator Controls (Priority: P2)

**Goal**: Expose current route hints, health, ordering reasons, compaction, and clear-by-scope controls through the committed CLI and MCP surfaces.

**Independent Test**: Operators and agents can inspect route hints from CLI and MCP, then compact or clear telemetry from CLI with correct scope, progress, and degraded-state reporting.

### Tests for User Story 3

- [X] T034 [P] [US3] Add MCP inspection tool tests for canonical state fields, deterministic profile handling, maintenance-status fields including `compactionProgress` and `affectedSourceLabels`, freshness fields, and raw-payload exclusion in `apps/server/tests/startup/inspect-route-hints.test.ts`
- [X] T035 [P] [US3] Add CLI command and workflow tests for deterministic profile handling, route-hint inspection, maintenance-status display including `compactionProgress` and `affectedSourceLabels`, freshness display, and raw-payload exclusion in `apps/cli/tests/commands/route-telemetry.test.tsx`
- [X] T036 [P] [US3] Add workflow regression tests for compact and clear flows in `tests/workflow/route-telemetry.workflow.test.ts`
- [X] T046 [P] [US3] Add interactive clear prompt-safety tests for scope review and confirmation behavior in `apps/cli/tests/commands/route-telemetry.prompt-safety.test.tsx`

### Implementation for User Story 3

- [X] T037 [US3] Add route-hint inspection methods, deterministic profile-summary handling, maintenance-status fields including `compactionProgress` and `affectedSourceLabels`, canonical state mapping, and freshness fields to the router in `packages/mcp-core/src/registry/router.ts`
- [X] T038 [US3] Register the `inspect_route_hints` management tool in `apps/server/src/startup/start-server.ts` and `apps/server/src/tools/unified/index.ts`
- [X] T039 [US3] Add CLI context wrappers for route-hint inspection and maintenance in `apps/cli/src/lib/context.ts`
- [X] T040 [US3] Add `mimirmesh mcp route-hints` workflow in `apps/cli/src/workflows/mcp.ts`
- [X] T041 [US3] Add `mimirmesh mcp route-hints` command in `apps/cli/src/commands/mcp/route-hints.tsx` with canonical state fields, display labels, freshness output, and telemetry-health guidance
- [X] T042 [US3] Add `runtime telemetry compact` workflow in `apps/cli/src/workflows/runtime.ts` and `apps/cli/src/commands/runtime/telemetry/compact.tsx`
- [X] T043 [US3] Add `runtime telemetry clear` workflow in `apps/cli/src/workflows/runtime.ts` and `apps/cli/src/commands/runtime/telemetry/clear.tsx` with explicit interactive scope review, confirmation UX, and safe non-interactive behavior
- [X] T057 [US3] Align route-telemetry inspection and maintenance flows to the shared CLI state/workflow model for TUI and direct-command parity in `apps/cli/src/lib/context.ts`, `apps/cli/src/workflows/mcp.ts`, and `apps/cli/src/workflows/runtime.ts`

**Checkpoint**: Inspection works from CLI and MCP, and maintenance works from CLI with scoped safety and clear reporting.

---

## Phase 6: User Story 4 - Merge-Safe Routing Semantics (Priority: P2)

**Goal**: Preserve fanout and merge behavior for non-allowlisted tools while still surfacing route telemetry diagnostics.

**Independent Test**: Merge-oriented tools such as `document_architecture`, `trace_integration`, and `evaluate_codebase` continue their existing fanout behavior while exposing static or diagnostic route-hint state.

### Tests for User Story 4

- [X] T044 [P] [US4] Add merge-semantics regression tests for non-allowlisted tools in `packages/mcp-core/tests/registry/router.merge-strategy.test.ts`
- [X] T045 [P] [US4] Add adapter metadata coverage tests in `packages/mcp-adapters/srclight/tests/routing.test.ts`, `packages/mcp-adapters/document-mcp/tests/routing.test.ts`, and `packages/mcp-adapters/mcp-adr-analysis-server/tests/routing.test.ts`

### Implementation for User Story 4

- [X] T047 [US4] Mark non-allowlisted merge-oriented tools as `fanout` in `packages/mcp-adapters/srclight/src/routing.ts`, `packages/mcp-adapters/document-mcp/src/routing.ts`, and `packages/mcp-adapters/mcp-adr-analysis-server/src/routing.ts`
- [X] T048 [US4] Gate adaptive execution to the effective allowlist while preserving diagnostic inspection for other tools in `packages/mcp-core/src/registry/router.ts` and `packages/mcp-core/src/routing/hints.ts`

**Checkpoint**: Adaptive routing is constrained to the intended subset and merge-safe behavior remains intact everywhere else.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finish validation, documentation, and cross-story hardening.

- [X] T054 [P] Add a static-versus-adaptive comparison harness for `search_code` and `find_symbol` in `tests/workflow/route-telemetry-benchmark.workflow.test.ts`
- [X] T055 Run the comparison harness, capture SC-001 and SC-002 evidence, and record the observed benchmark results in `docs/specifications/011-route-cost-telemetry/validation.md`
- [X] T056 Start the project runtime, verify engine bootstrap/readiness evidence, execute live route-hint and maintenance scenarios, and record observed readiness plus maintenance-status behavior in `docs/specifications/011-route-cost-telemetry/validation.md`
- [X] T049 [P] Update observed route-hint behavior in `docs/features/mcp-server.md`, `docs/features/cli-command-surface.md`, and `docs/operations/runtime.md` after `docs/specifications/011-route-cost-telemetry/validation.md` captures benchmark and live-runtime evidence
- [X] T050 Run and update quickstart validation in `docs/specifications/011-route-cost-telemetry/quickstart.md` after `docs/specifications/011-route-cost-telemetry/validation.md` captures benchmark and live-runtime evidence
- [X] T051 [P] Run package-local test suites for telemetry changes in `packages/runtime/tests`, `packages/mcp-core/tests`, `packages/mcp-adapters/*/tests`, `apps/cli/tests`, and `apps/server/tests`
- [X] T052 [P] Run workflow and regression validation in `tests/workflow/route-telemetry.workflow.test.ts` and related root validation suites under `tests/`
- [X] T053 Validate CLI progress visibility, structured output, machine-readable parity, TUI/direct-command parity, and prompt safety in `apps/cli/src/workflows/mcp.ts` and `apps/cli/src/workflows/runtime.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: Starts immediately.
- **Phase 2: Foundational**: Depends on Phase 1 and blocks all story work.
- **Phase 3: User Story 1**: Depends on Phase 2.
- **Phase 4: User Story 2**: Depends on Phase 2; it can begin after the shared telemetry primitives exist, but it benefits from US1 route writes for richer validation.
- **Phase 5: User Story 3**: Depends on Phase 2 and the persistence/maintenance behavior from US2.
- **Phase 6: User Story 4**: Depends on Phase 2 and should land after US1 adaptive ordering is in place so regressions are measurable.
- **Phase 7: Polish**: Depends on all selected stories being complete.

### User Story Dependencies

- **US1**: Primary MVP slice once foundational telemetry primitives exist.
- **US2**: Hardens durability and bounded-growth behavior for the same telemetry subsystem; should complete before broad rollout.
- **US3**: Depends on telemetry persistence and maintenance services so inspection and operator controls can report real state.
- **US4**: Depends on adaptive ordering behavior from US1 so merge-safe regression protection is meaningful.

### Within Each User Story

- Tests should be written before or alongside implementation and must fail meaningfully before the core code path is completed.
- Shared types and config gates should land before router, CLI, or server integration.
- Persistence and maintenance services should land before user-facing inspection and operator flows.

### Parallel Opportunities

- `T003`, `T004`, and `T005` can run in parallel after `T001` and `T002`.
- `T008`, `T009`, `T010`, and `T011` can run in parallel once the base config/types are present.
- US1 tests `T015`, `T016`, and `T017` can run in parallel.
- US2 tests `T025`, `T026`, and `T027` can run in parallel.
- US3 tests `T034`, `T035`, and `T036` can run in parallel.
- US4 tests `T044` and `T045` can run in parallel.
- Evidence tasks `T055` and `T056` can run in parallel once implementation is complete; documentation tasks `T049` and `T050` start after those evidence tasks finish.

---

## Parallel Example: User Story 1

```bash
# Run the US1 validation work together:
Task: T015 [US1] Add adaptive scoring and tie-break tests in packages/mcp-core/tests/routing/route-hints.test.ts
Task: T016 [US1] Add router regression tests for allowlist gating and deterministic fallback in packages/mcp-core/tests/registry/router.route-hints.test.ts
Task: T017 [US1] Add config override validation tests for mcp.routingHints.adaptiveSubset in packages/config/tests/schema/routing-hints.test.ts

# Implement parallelizable US1 metadata work:
Task: T018 [US1] Add seed hints and fallback-only strategy metadata in packages/mcp-adapters/srclight/src/routing.ts
Task: T019 [US1] Extend shared adapter route resolution in packages/mcp-adapters/src/utils.ts
```

## Parallel Example: User Story 2

```bash
# Run telemetry durability tests together:
Task: T025 [US2] Add migration and raw-event persistence tests in packages/runtime/tests/state/route-telemetry-migrations.test.ts
Task: T026 [US2] Add rollup, pruning, and idempotency tests in packages/runtime/tests/services/route-telemetry-maintenance.test.ts
Task: T027 [US2] Add runtime lifecycle telemetry-health tests in packages/runtime/tests/services/runtime-lifecycle.telemetry.test.ts
```

## Parallel Example: User Story 3

```bash
# Build inspection and operator-surface tests together:
Task: T034 [US3] Add MCP inspection tool tests in apps/server/tests/startup/inspect-route-hints.test.ts
Task: T035 [US3] Add CLI command and workflow tests in apps/cli/tests/commands/route-telemetry.test.tsx
Task: T036 [US3] Add workflow regression tests in tests/workflow/route-telemetry.workflow.test.ts
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate `search_code` and `find_symbol` adaptive ordering independently.

### Incremental Delivery

1. Deliver US1 for adaptive ordering on the initial allowlist.
2. Deliver US2 to make the telemetry durable, bounded, and production-safe.
3. Deliver US3 so operators and agents can inspect and maintain the subsystem.
4. Deliver US4 to lock in merge-safe behavior and prevent routing regressions.

### Suggested Release Gate

Do not consider the feature production-ready until Phases 3 through 7 are complete. US1 is the MVP slice, but US2 and US3 are required for the durable and explainable product contract defined in the specification.

---

## Notes

- `[P]` tasks target different files or isolated suites and can be worked in parallel.
- Route telemetry is operational metadata only; no task should introduce raw request or result persistence.
- Repository overrides are constrained to the supported eligible built-in set for this slice.
- Merge-oriented tools keep `fanout` behavior even after adaptive routing lands for the allowlist.
