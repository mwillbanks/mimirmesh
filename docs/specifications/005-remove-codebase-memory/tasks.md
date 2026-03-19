# Tasks: Remove Codebase-Memory MCP Engine

**Input**: Design documents from `/docs/specifications/005-remove-codebase-memory/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

## Phase 1: Setup

**Purpose**: Prepare shared fixtures and migration test inputs used across stories.

- [X] T001 Create legacy retired-engine config fixture in packages/config/tests/fixtures/legacy-codebase-memory.yml
- [X] T002 [P] Create overlap precedence fixture in packages/config/tests/fixtures/legacy-and-srclight-overlap.yml
- [X] T003 [P] Create write-failure migration fixture in packages/config/tests/fixtures/legacy-write-failure.yml

---

## Phase 2: Core Prerequisites (Blocking)

**Purpose**: Add shared migration plumbing and reusable assertions needed before story work.

- [X] T004 Implement config migration entrypoint hooks in packages/config/src/readers/index.ts
- [X] T005 [P] Implement retired-engine to Srclight transform helper in packages/config/src/readers/migrate-codebase-memory.ts
- [X] T006 [P] Add shared retired-engine absence test helpers in packages/testing/src/fixtures/runtime-upgrade.ts

**Checkpoint**: Blocking prerequisites complete; user story work can begin.

---

## Phase 3: User Story 1 - Runtime Uses Srclight As Single Code-Intelligence Engine (Priority: P1) 🎯 MVP

**Goal**: Runtime startup/discovery/routing runs without codebase-memory service while Srclight remains healthy.

**Independent Test**: Initialize and start runtime, then confirm compose/discovery/routing have zero codebase-memory surface and successful Srclight code-intelligence flow.

### Tests for User Story 1

- [X] T007 [P] [US1] Update compose rendering assertions for retired service absence in packages/runtime/tests/compose/render.test.ts
- [X] T008 [P] [US1] Update runtime lifecycle integration expectations for retired engine absence in tests/integration/engines.test.ts
- [X] T009 [P] [US1] Update mcp integration expectations for active-engine discovery only in tests/integration/mcp-integration.test.ts

### Implementation for User Story 1

- [X] T010 [US1] Remove retired compose bootstrap/service branches in packages/runtime/src/compose/generate.ts
- [X] T011 [US1] Remove retired runtime lifecycle engine branches in packages/runtime/src/services/runtime-lifecycle.ts
- [X] T012 [US1] Remove retired image selection/build references in scripts/run-integration-tests.ts
- [X] T013 [US1] Delete retired runtime image directory docker/images/codebase-memory/

**Checkpoint**: User Story 1 independently verifies runtime truth with Srclight only.

---

## Phase 4: User Story 2 - Config And Adapter Model Excludes Retired Engine (Priority: P2)

**Goal**: Schema/defaults/adapter registry and CLI engine toggles exclude codebase-memory while legacy config migration is deterministic.

**Independent Test**: Validate schema/defaults/adapter list and run migration tests for one-time write-back, precedence, and failure behavior.

### Tests for User Story 2

- [X] T014 [P] [US2] Add migration success and idempotence tests in packages/config/tests/readers/migration-codebase-memory.test.ts
- [X] T015 [P] [US2] Add migration precedence and overlap tests in packages/config/tests/readers/migration-codebase-memory-precedence.test.ts
- [X] T016 [P] [US2] Add migration write-failure remediation tests in packages/config/tests/readers/migration-codebase-memory-failure.test.ts
- [X] T017 [P] [US2] Update adapter registry routing tests for retired adapter removal in packages/mcp-core/tests/registry/router.test.ts
- [X] T018 [P] [US2] Update bridge transport tests for active engines only in packages/mcp-core/tests/transport/bridge.test.ts

### Implementation for User Story 2

- [X] T019 [US2] Remove retired engine schemas and enums in packages/config/src/schema/index.ts
- [X] T020 [US2] Remove retired default engine block in packages/config/src/defaults/index.ts
- [X] T021 [US2] Finalize one-time migration write-back and precedence logic in packages/config/src/readers/index.ts and packages/config/src/readers/migrate-codebase-memory.ts
- [X] T022 [US2] Remove retired adapter registration/export in packages/mcp-adapters/src/index.ts
- [X] T023 [US2] Remove retired CLI engine options in apps/cli/src/commands/config/enable.tsx and apps/cli/src/commands/config/disable.tsx
- [X] T024 [US2] Delete retired adapter implementation package at packages/mcp-adapters/codebase-memory-mcp/
- [X] T025 [US2] Update runtime state and upgrade decision tests for retired engine absence in packages/runtime/tests/state/io.test.ts and packages/runtime/tests/upgrade/decisions.test.ts

**Checkpoint**: User Story 2 independently validates config and adapter retirement plus migration behavior.

---

## Phase 5: User Story 3 - Documentation And Tests Reflect Engine Retirement (Priority: P3)

**Goal**: Runtime/MCP docs and regression coverage reflect retired engine reality.

**Independent Test**: Review docs for active-engine guidance and run regression suites asserting zero retired-engine expectations.

### Tests for User Story 3

- [X] T026 [P] [US3] Update workflow assertions for supported engines in tests/workflow/interactive-cli-direct-commands.test.ts
- [X] T027 [P] [US3] Update workflow entry assertions for engine listings in tests/workflow/interactive-cli-entry.test.ts

### Implementation for User Story 3

- [X] T028 [US3] Update MCP feature docs to remove active retired-engine guidance in docs/features/mcp-client.md and docs/features/mcp-server.md
- [X] T029 [US3] Update runtime operations guidance for Srclight-only code intelligence in docs/operations/runtime.md
- [X] T030 [US3] Update bridge runtime ADR examples to remove active retired-engine references in docs/adr/0003-bridge-backed-external-engine-runtime.md
- [X] T031 [US3] Mark retired-engine status in production implementation reference doc docs/specifications/mimirmesh-production-implementation-v1.md

**Checkpoint**: User Story 3 independently verifies documentation/test truthfulness after retirement.

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Complete end-to-end verification and quality gates.

- [X] T032 [P] Run package tests for touched packages with bun test packages/config packages/runtime packages/mcp-core packages/mcp-adapters
- [X] T033 [P] Run integration and workflow regressions with bun run scripts/run-integration-tests.ts and bun test tests/workflow
- [X] T034 [P] Run lint and type checks with bun run check and bun run typecheck
- [X] T035 Run quickstart validation steps and align observed outcomes in docs/specifications/005-remove-codebase-memory/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): Starts immediately.
- Core Prerequisites (Phase 2): Depends on Setup completion and blocks story work.
- User Stories (Phases 3-5): Start after Phase 2; can proceed by priority or in parallel with staffing.
- Polish (Phase 6): Runs after selected story phases are complete.

### User Story Dependencies

- User Story 1 (P1): Starts after Phase 2; no dependency on other stories.
- User Story 2 (P2): Starts after Phase 2; independent validation of schema/defaults/migration/registry.
- User Story 3 (P3): Starts after Phase 2; depends only on updated runtime truth from completed implementation tasks.

### Within Each User Story

- Tests are created before implementation edits.
- Runtime/config contract changes precede broad integration verification.
- Story checkpoint must pass before moving to lower-priority story for sequential delivery.

## Parallel Execution Examples

### User Story 1

```bash
# Parallel test updates
T007 packages/runtime/tests/compose/render.test.ts
T008 tests/integration/engines.test.ts
T009 tests/integration/mcp-integration.test.ts
```

### User Story 2

```bash
# Parallel migration and registry tests
T014 packages/config/tests/readers/migration-codebase-memory.test.ts
T015 packages/config/tests/readers/migration-codebase-memory-precedence.test.ts
T016 packages/config/tests/readers/migration-codebase-memory-failure.test.ts
T017 packages/mcp-core/tests/registry/router.test.ts
T018 packages/mcp-core/tests/transport/bridge.test.ts
```

### User Story 3

```bash
# Parallel documentation updates
T028 docs/features/mcp-client.md
T029 docs/operations/runtime.md
T030 docs/adr/0003-bridge-backed-external-engine-runtime.md
```

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate US1 independent test criteria before expanding scope.

### Incremental Delivery

1. Deliver US1 runtime retirement behavior.
2. Deliver US2 config/adapter retirement and migration guarantees.
3. Deliver US3 documentation/workflow alignment.
4. Finish with Phase 6 quality gates.

### Parallel Team Strategy

1. One engineer handles runtime retirement tasks (US1).
2. One engineer handles config/schema/adapter retirement and migration (US2).
3. One engineer handles docs/workflow test alignment (US3).
4. Converge on shared quality gates in Phase 6.

## Notes

- `[P]` tasks target separate files and can run concurrently.
- `[US1]`, `[US2]`, `[US3]` labels provide traceability to spec stories.
- Deleted-path tasks must remove directories and update imports in the same change set.
- Keep runtime/discovery behavior live-validated; do not introduce synthetic tool catalogs.
