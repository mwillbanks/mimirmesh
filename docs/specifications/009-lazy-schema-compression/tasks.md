# Tasks: Token Reduction via Lazy Tool Registration and Schema Compression

**Input**: Design documents from `/docs/specifications/009-lazy-schema-compression/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/mcp-tool-surface.md`

**Tests**: Tests are required for this feature because the specification defines mandatory runtime validation, CLI validation, session-isolation validation, and CI-safe unit/integration coverage.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently once the blocking phases are complete.

## Phase 1: Setup

**Purpose**: Establish execution tracking and test scaffolding required before implementation starts.

- [X] T001 Initialize hardening execution tracking in `.agents/tasks/TASK_INDEX.md`, `.agents/reports/REPORT_INDEX.md`, and the corresponding task/report state files for this feature
- [X] T002 [P] Create MCP server and CLI test scaffolds in `apps/server/tests/startup/start-server.test.ts` and `apps/cli/tests/commands/mcp/list-tools.test.tsx`
- [X] T003 [P] Create workflow and integration test scaffolds in `apps/cli/tests/workflows/mcp.test.ts`, `tests/workflow/mcp-load-tools.test.ts`, and `tests/integration/mcp/lazy-load.test.ts`

---

## Phase 2: Foundational

**Purpose**: Build the shared policy, session-state, and notification infrastructure that blocks all user stories.

**⚠️ CRITICAL**: No user story implementation begins until this phase is complete.

- [X] T004 Implement MCP tool-surface policy schema, defaults, and validation coverage in `packages/config/src/schema/index.ts`, `packages/config/src/defaults/index.ts`, `packages/config/src/index.ts`, and `packages/config/tests/schema/config.test.ts`
- [X] T005 [P] Extend runtime session state models and persistence for per-session tool surfaces in `packages/runtime/src/types/index.ts`, `packages/runtime/src/state/mcp-server.ts`, `packages/runtime/src/index.ts`, and `packages/runtime/tests/state/mcp-server.test.ts`
- [X] T006 [P] Add compression and session-surface contracts to shared MCP core exports in `packages/mcp-core/src/types/index.ts` and `packages/mcp-core/src/index.ts`
- [X] T007 Implement live policy/runtime loading helpers for session-scoped routing in `packages/mcp-core/src/discovery/runtime.ts` and `packages/runtime/src/services/runtime-lifecycle.ts`
- [X] T047 [P] Add engine bootstrap and indexing verification tests for startup evidence in `apps/server/tests/startup/start-server.test.ts` and `packages/runtime/tests/discovery/discover.test.ts`
- [X] T008 Implement server-side session registry, startup readiness gating, and MCP tool-refresh notification plumbing in `apps/server/src/startup/start-server.ts`
- [X] T048 Implement bootstrap verification evidence and startup bootstrap assertions in `packages/runtime/src/services/runtime-lifecycle.ts` and `apps/server/src/startup/start-server.ts`
- [X] T009 Extend shared CLI MCP workflow context and machine-readable inspection payloads for core, deferred, and loaded groups in `apps/cli/src/workflows/mcp.ts` and `apps/cli/tests/lib/machine-readable.test.ts`

**Checkpoint**: Shared policy, session state, and notification primitives are ready for story work.

---

## Phase 3: User Story 1 - Minimal Initial Tool Surface (Priority: P1) 🎯 MVP

**Goal**: Expose only the core routed tool surface at session start while clearly advertising deferred capability.

**Independent Test**: Start a new MCP session and verify `listTools()` exposes only core tools plus deferred indicators, with no passthrough group loaded yet.

### Tests for User Story 1

- [X] T010 [P] [US1] Add core-surface router tests in `packages/mcp-core/tests/registry/router.test.ts` and `packages/mcp-core/tests/registry/router.regressions.test.ts`
- [X] T011 [P] [US1] Add MCP server startup registration tests in `apps/server/tests/startup/start-server.test.ts`
- [X] T012 [P] [US1] Add CLI list-tools presentation tests in `apps/cli/tests/commands/mcp/list-tools.test.tsx` and `apps/cli/tests/workflows/mcp.test.ts`
- [X] T045 [P] [US1] Add startup readiness-gate tests in `apps/server/tests/startup/start-server.test.ts` and `packages/runtime/tests/state/mcp-server.test.ts`

### Implementation for User Story 1

- [X] T013 [US1] Build initial session tool-surface assembly and core/deferred filtering in `packages/mcp-core/src/registry/router.ts` and `packages/mcp-core/src/registry/unified.ts`
- [X] T014 [US1] Register only compressed core tools and required deferred-management tools at server startup in `apps/server/src/startup/start-server.ts` and `apps/server/src/tools/passthrough/index.ts`, retaining concise descriptions in the published MCP tool surface
- [X] T015 [US1] Render core vs deferred tool groups and initial tool-surface counts in `apps/cli/src/commands/mcp/list-tools.tsx` and `apps/cli/src/workflows/mcp.ts`

**Checkpoint**: New sessions expose a minimal, independently testable core tool surface.

---

## Phase 4: User Story 2 - Lazy Load Passthrough Engine Groups (Priority: P1)

**Goal**: Load a deferred engine group on demand for one session, notify the client, and keep other sessions isolated.

**Independent Test**: Load one deferred engine group from a session, refresh tools after notification, and verify the new tools appear only in that session.

### Tests for User Story 2

- [X] T016 [P] [US2] Add live-discovery and session-isolation tests in `packages/runtime/tests/discovery/discover.test.ts` and `packages/runtime/tests/state/mcp-server.test.ts`
- [X] T017 [P] [US2] Add lazy-load routing and notification tests in `packages/mcp-core/tests/registry/router.regressions.test.ts` and `packages/mcp-core/tests/routing/table.test.ts`
- [X] T018 [P] [US2] Add explicit load and cross-session isolation coverage in `tests/integration/mcp/lazy-load.test.ts` and `tests/workflow/mcp-load-tools.test.ts`

### Implementation for User Story 2

- [X] T019 [US2] Implement per-session deferred-engine load orchestration and refresh semantics in `packages/mcp-core/src/registry/router.ts` and `packages/mcp-core/src/discovery/runtime.ts`
- [X] T020 [US2] Emit `notifications/tools/list_changed` and refresh visible registrations after lazy load in `apps/server/src/startup/start-server.ts`
- [X] T021 [US2] Add the explicit deferred-group load command and progress workflow in `apps/cli/src/commands/mcp/load-tools.tsx` and `apps/cli/src/workflows/mcp.ts`
- [X] T022 [US2] Persist lazy-load diagnostics, structured logging fields, and loaded/deferred session state for runtime status in `packages/runtime/src/services/runtime-lifecycle.ts` and `packages/runtime/src/state/mcp-server.ts`
- [X] T046 [P] [US2] Add structured lazy-load logging tests in `packages/runtime/tests/state/mcp-server.test.ts` and `apps/server/tests/startup/start-server.test.ts`

**Checkpoint**: Deferred engine groups load on demand, refresh correctly, and remain session-scoped.

---

## Phase 5: User Story 3 - Compressed Tool Schemas and Full Schema Access (Priority: P1)

**Goal**: Compress visible tool metadata while preserving an MCP-compatible path to inspect fuller per-tool schemas.

**Independent Test**: Compare compressed and fuller schema views for the same tool and verify token reduction plus sufficient semantic meaning.

### Tests for User Story 3

- [X] T023 [P] [US3] Add compression-profile and config validation tests in `packages/config/tests/schema/config.test.ts`
- [X] T024 [P] [US3] Add compressed descriptor and schema-inspection tests in `packages/mcp-core/tests/registry/router.test.ts` and `packages/mcp-core/tests/registry/unified.test.ts`
- [X] T025 [P] [US3] Add CLI schema-view tests in `apps/cli/tests/commands/mcp/tool-schema.test.tsx` and `apps/cli/tests/workflows/mcp.test.ts`

### Implementation for User Story 3

- [X] T026 [US3] Implement compression profiles and tool-surface policy parsing in `packages/config/src/schema/index.ts`, `packages/config/src/defaults/index.ts`, and `packages/config/src/index.ts`
- [X] T027 [US3] Implement compressed descriptor formatting and fuller schema inspection handlers in `packages/mcp-core/src/registry/router.ts` and `apps/server/src/startup/start-server.ts`
- [X] T028 [US3] Add compressed vs full schema CLI views in `apps/cli/src/commands/mcp/tool-schema.tsx` and `apps/cli/src/workflows/mcp.ts`

**Checkpoint**: Clients can operate on compressed metadata and request fuller schema detail independently of other stories.

---

## Phase 6: User Story 4 - Graceful Degraded and Offline Handling (Priority: P2)

**Goal**: Surface truthful degraded-mode diagnostics for constrained or offline environments during deferred-tool operations.

**Independent Test**: Simulate unavailable bridge connectivity and verify clear diagnostics, fallback messaging, and no false loaded state.

### Tests for User Story 4

- [X] T029 [P] [US4] Add degraded and offline lazy-load tests with mocked bridge failures in `packages/runtime/tests/discovery/discover.test.ts` and `packages/mcp-core/tests/registry/router.regressions.test.ts`
- [X] T030 [P] [US4] Add CLI/runtime degraded diagnostics coverage in `apps/cli/tests/commands/runtime/status-mcp-tools.test.tsx` and `tests/integration/mcp/offline-lazy-load.test.ts`

### Implementation for User Story 4

- [X] T031 [US4] Implement degraded lazy-load diagnostics and fallback messaging in `packages/mcp-core/src/registry/router.ts` and `packages/runtime/src/services/runtime-lifecycle.ts`
- [X] T032 [US4] Surface unavailable/deferred engine reasons in `apps/cli/src/commands/runtime/status.tsx` and `apps/cli/src/workflows/mcp.ts`

**Checkpoint**: Offline and degraded deferred-tool behavior is independently testable and truthful.

---

## Phase 7: User Story 5 - Configurable Tool Policies (Priority: P2)

**Goal**: Let operators change core/deferred/compression policies live for future operations while requiring explicit refresh for already-loaded groups.

**Independent Test**: Change tool-surface policy in config, observe subsequent list/load behavior update within 5 seconds, and verify loaded groups remain stable until refreshed.

### Tests for User Story 5

- [X] T033 [P] [US5] Add live policy reload and refresh-gating tests in `packages/config/tests/schema/config.test.ts` and `packages/runtime/tests/state/mcp-server.test.ts`
- [X] T034 [P] [US5] Add CLI policy mutation tests in `apps/cli/tests/commands/config/set.test.tsx` and `apps/cli/tests/commands/mcp/load-tools.test.tsx`

### Implementation for User Story 5

- [X] T035 [US5] Implement tool-surface policy persistence and mutation support in `packages/config/src/mutations/index.ts`, `packages/config/src/writers/index.ts`, and `packages/config/src/index.ts`
- [X] T036 [US5] Apply live policy reload with explicit loaded-group refresh gating in `packages/mcp-core/src/discovery/runtime.ts` and `apps/server/src/startup/start-server.ts`
- [X] T037 [US5] Add operator policy update flows in `apps/cli/src/commands/config/set.tsx` and `apps/cli/src/workflows/mcp.ts`
- [X] T038 [US5] Extend runtime status reporting for compression counts and loaded/deferred groups in `packages/runtime/src/services/runtime-lifecycle.ts` and `apps/cli/src/commands/runtime/status.tsx`

**Checkpoint**: Operators can independently adjust tool policies and validate live reload behavior.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Complete documentation, hardening validation, final Biome enforcement, and mandatory self-review.

- [X] T039 [P] Update observed feature documentation in `docs/features/mcp-client.md`, `docs/features/mcp-server.md`, and `docs/operations/runtime.md`
- [X] T040 [P] Update quickstart and operator runbook guidance in `docs/specifications/009-lazy-schema-compression/quickstart.md` and `docs/runbooks/first-init.md`
- [X] T049 [P] Add benchmark coverage for default token reduction, post-load token cost, and compression ratios in `packages/mcp-core/tests/registry/router.performance.test.ts` and `apps/server/tests/startup/start-server.test.ts`
- [X] T050 [P] Add latency and policy-propagation timing coverage for lazy-load completion and refreshed tool visibility in `tests/integration/mcp/lazy-load-latency.test.ts` and `tests/workflow/mcp-policy-refresh.test.ts`
- [X] T041 Run targeted hardening validation across `packages/mcp-core/tests/`, `packages/runtime/tests/`, `packages/config/tests/`, `apps/cli/tests/`, `tests/workflow/`, and `tests/integration/`
- [X] T051 Run measurable outcome validation for SC-001, SC-002, SC-003, SC-005, SC-007, and RVO-004 and record benchmark results in `docs/specifications/009-lazy-schema-compression/quickstart.md` and `docs/features/mcp-server.md`
- [X] T042 Run Bun-native repository validation through `package.json` scripts `typecheck`, `test`, and `build`
- [X] T043 Run final Biome enforcement and post-Biome revalidation using `biome.json` and the changed-files JSON reporter command from the repository root
- [X] T044 Record completion, execute mandatory `agent-execution-mode` `agentic-self-review`, and update `.agents/tasks/TASK_INDEX.md`, `.agents/reviews/`, and `.agents/reports/REPORT_INDEX.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies; start immediately.
- **Phase 2: Foundational**: Depends on Setup; blocks all story work.
- **Phase 3: User Story 1**: Depends on Foundational; delivers the MVP minimal surface and startup readiness gating after bootstrap verification evidence is in place.
- **Phase 4: User Story 2**: Depends on User Story 1 because lazy loading extends the initial session surface and server registration model.
- **Phase 5: User Story 3**: Depends on User Story 1; can run in parallel with late User Story 2 work once the session surface exists.
- **Phase 6: User Story 4**: Depends on User Story 2 because degraded handling builds on lazy-load behavior.
- **Phase 7: User Story 5**: Depends on Foundational and benefits from User Stories 2 and 3 because policy reload affects lazy loading and compression.
- **Phase 8: Polish**: Depends on all targeted user stories being complete.

### User Story Dependencies

- **US1**: First deliverable and MVP slice.
- **US2**: Requires US1 session-surface behavior.
- **US3**: Requires US1 initial surface; can proceed alongside parts of US2 after foundational primitives are stable.
- **US4**: Requires US2 lazy-load behavior.
- **US5**: Requires foundational policy primitives and should land after US2/US3 semantics are stable.

### Parallel Opportunities

- Setup tasks `T002` and `T003` can run in parallel.
- Foundational tasks `T005`, `T006`, and `T047` can run in parallel after `T004` begins.
- Test tasks marked `[P]` within each user story can run in parallel.
- US3 can start after US1 while US2 is still being finalized if team capacity allows.

---

## Parallel Example: User Story 1

```bash
# Parallel tests for User Story 1
Task: T010 Add core-surface router tests in packages/mcp-core/tests/registry/router.test.ts and packages/mcp-core/tests/registry/router.regressions.test.ts
Task: T011 Add MCP server startup registration tests in apps/server/tests/startup/start-server.test.ts
Task: T012 Add CLI list-tools presentation tests in apps/cli/tests/commands/mcp/list-tools.test.tsx and apps/cli/tests/workflows/mcp.test.ts

# Parallel implementation after tests exist
Task: T013 Build initial session tool-surface assembly and core/deferred filtering in packages/mcp-core/src/registry/router.ts and packages/mcp-core/src/registry/unified.ts
Task: T014 Register only compressed core tools and required deferred-management tools at server startup in apps/server/src/startup/start-server.ts and apps/server/src/tools/passthrough/index.ts
```

## Parallel Example: User Story 2

```bash
# Parallel tests for User Story 2
Task: T016 Add live-discovery and session-isolation tests in packages/runtime/tests/discovery/discover.test.ts and packages/runtime/tests/state/mcp-server.test.ts
Task: T017 Add lazy-load routing and notification tests in packages/mcp-core/tests/registry/router.regressions.test.ts and packages/mcp-core/tests/routing/table.test.ts
Task: T018 Add explicit load and cross-session isolation coverage in tests/integration/mcp/lazy-load.test.ts and tests/workflow/mcp-load-tools.test.ts
```

## Parallel Example: User Story 3

```bash
# Parallel tests for User Story 3
Task: T023 Add compression-profile and config validation tests in packages/config/tests/schema/config.test.ts
Task: T024 Add compressed descriptor and schema-inspection tests in packages/mcp-core/tests/registry/router.test.ts and packages/mcp-core/tests/registry/unified.test.ts
Task: T025 Add CLI schema-view tests in apps/cli/tests/commands/mcp/tool-schema.test.tsx and apps/cli/tests/workflows/mcp.test.ts
```

## Parallel Example: User Story 5

```bash
# Parallel tests for User Story 5
Task: T033 Add live policy reload and refresh-gating tests in packages/config/tests/schema/config.test.ts and packages/runtime/tests/state/mcp-server.test.ts
Task: T034 Add CLI policy mutation tests in apps/cli/tests/commands/config/set.test.tsx and apps/cli/tests/commands/mcp/load-tools.test.tsx
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate the MVP by starting a session and confirming only the compressed core tool surface is visible

### Incremental Delivery

1. Deliver US1 for the minimal initial surface
2. Deliver US2 for session-scoped lazy loading and notifications
3. Deliver US3 for richer compression profiles and fuller schema access
4. Deliver US4 for degraded/offline truthfulness
5. Deliver US5 for live policy changes and refresh gating
6. Finish with Phase 8 hardening, explicit benchmark validation, Biome enforcement, and mandatory self-review

### Hardening Gates

1. Execute implementation under `agent-execution-mode` `hardening`
2. Apply `code-discipline` during all shared-package and CLI changes
3. Apply `repo-standards-enforcement` for Bun-native validation order and repo-boundary compliance
4. Apply `mm-unit-testing` when writing or repairing unit and integration tests
5. Run `biome-enforcement` as the final remediation loop before handoff
6. After claiming completion, run `agent-execution-mode` `agentic-self-review` and fix safe findings
