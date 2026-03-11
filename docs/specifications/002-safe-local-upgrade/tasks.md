# Tasks: Safe Project-Local Upgrade

**Input**: Design documents from `/docs/specifications/002-safe-local-upgrade/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are required for this feature because the plan explicitly calls for version comparison, migration execution, backup/restore, no-op upgrade, incompatible-state detection, and end-to-end project upgrade validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the upgrade implementation scaffolding and reusable fixture support.

- [x] T001 Create runtime upgrade module exports in `packages/runtime/src/upgrade/index.ts` and `packages/runtime/src/index.ts`
- [x] T002 [P] Create upgrade fixture helpers for versioned `.mimirmesh` states in `packages/testing/src/fixtures/runtime-upgrade.ts` and `packages/testing/src/index.ts`
- [x] T003 [P] Create runtime upgrade command scaffolding in `apps/cli/src/commands/runtime/upgrade/index.tsx`, `apps/cli/src/commands/runtime/upgrade/status.tsx`, `apps/cli/src/commands/runtime/upgrade/migrate.tsx`, and `apps/cli/src/commands/runtime/upgrade/repair.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Introduce the shared versioning, persistence, and compatibility primitives that every upgrade workflow depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Add versioned project-runtime state schemas in `packages/config/src/schema/index.ts` and `packages/runtime/src/types/index.ts`
- [x] T005 [P] Add upgrade metadata, checkpoint, and backup path helpers in `packages/runtime/src/state/paths.ts` and `packages/runtime/src/state/io.ts`
- [x] T006 [P] Implement runtime version comparison and compatibility-window primitives in `packages/runtime/src/upgrade/versioning.ts` and `packages/runtime/src/upgrade/types.ts`
- [x] T007 [P] Implement backup manifest and checkpoint persistence services in `packages/runtime/src/upgrade/backups.ts` and `packages/runtime/src/upgrade/checkpoints.ts`
- [x] T008 [P] Implement preserved-asset classification and engine upgrade decision models in `packages/runtime/src/upgrade/assets.ts` and `packages/runtime/src/upgrade/decisions.ts`
- [x] T009 Implement shared upgrade status and outcome interfaces in `packages/runtime/src/upgrade/contracts.ts` and `packages/runtime/src/types/index.ts`
- [x] T010 Add foundational unit coverage for versioning, checkpoints, and backups in `packages/runtime/src/upgrade/versioning.test.ts`, `packages/runtime/src/upgrade/checkpoints.test.ts`, and `packages/runtime/src/upgrade/backups.test.ts`

**Checkpoint**: Shared upgrade primitives, state files, and compatibility rules are ready for story work.

---

## Phase 3: User Story 1 - Upgrade In Place Without Losing Project Knowledge (Priority: P1) 🎯 MVP

**Goal**: Deliver an in-place migrate flow that upgrades runtime components and compatible project-local state without deleting `.mimirmesh`.

**Independent Test**: Start from a supported older `.mimirmesh` fixture containing indexes, reports, notes, and runtime metadata, run `mimirmesh runtime upgrade migrate`, and confirm the runtime is reconciled in place with preserved compatible state and truthful health output.

### Tests for User Story 1

- [x] T011 [P] [US1] Add migration planner and no-op upgrade coverage in `packages/runtime/src/upgrade/planner.test.ts` and `packages/testing/src/integration/runtime-upgrade-noop.test.ts`
- [x] T012 [P] [US1] Add end-to-end in-place project upgrade coverage in `tests/workflow/project-runtime-upgrade.test.ts`

### Implementation for User Story 1

- [x] T013 [P] [US1] Implement ordered migration planning and step execution in `packages/runtime/src/upgrade/planner.ts` and `packages/runtime/src/upgrade/migrate.ts`
- [x] T014 [P] [US1] Implement drift-aware runtime reconciliation for compose, engine image, and bootstrap changes in `packages/runtime/src/upgrade/reconcile.ts` and `packages/runtime/src/services/runtime-lifecycle.ts`
- [x] T015 [US1] Implement backup-before-mutate and step-local rollback wiring in `packages/runtime/src/upgrade/migrate.ts` and `packages/runtime/src/upgrade/backups.ts`
- [x] T016 [US1] Implement preserved-asset validation and quarantine flow in `packages/runtime/src/upgrade/validate.ts` and `packages/runtime/src/health/state.ts`
- [x] T017 [US1] Add runtime upgrade migrate and refresh context helpers in `apps/cli/src/lib/context.ts` and `packages/runtime/src/index.ts`
- [x] T018 [US1] Implement `mimirmesh runtime upgrade migrate` and upgrade-aware `mimirmesh runtime refresh` command behavior in `apps/cli/src/commands/runtime/upgrade/migrate.tsx` and `apps/cli/src/commands/refresh.tsx`

**Checkpoint**: The project can be upgraded in place for supported states without deleting `.mimirmesh`, and preserved compatible assets remain available or are degraded truthfully.

---

## Phase 4: User Story 2 - Inspect Upgrade Readiness and Drift (Priority: P2)

**Goal**: Provide a truthful status flow that classifies current, outdated, repairable, blocked, and degraded project-local installations.

**Independent Test**: Evaluate representative current, outdated, blocked, and degraded fixtures with `mimirmesh runtime upgrade status` and confirm the command reports version evidence, compatibility eligibility, drift categories, and next actions correctly.

### Tests for User Story 2

- [x] T019 [P] [US2] Add status classification tests for current, outdated, blocked, and degraded states in `packages/runtime/src/upgrade/status.test.ts` and `packages/testing/src/integration/runtime-upgrade-status.test.ts`

### Implementation for User Story 2

- [x] T020 [P] [US2] Implement upgrade status classification and compatibility-window enforcement in `packages/runtime/src/upgrade/status.ts` and `packages/runtime/src/upgrade/versioning.ts`
- [x] T021 [US2] Persist project runtime version evidence during init, start, and reconcile flows in `packages/runtime/src/upgrade/metadata.ts` and `packages/runtime/src/services/runtime-lifecycle.ts`
- [x] T022 [US2] Add `mimirmesh runtime upgrade status` context wiring in `apps/cli/src/lib/context.ts` and `packages/runtime/src/index.ts`
- [x] T023 [US2] Implement the `mimirmesh runtime upgrade status` command output in `apps/cli/src/commands/runtime/upgrade/status.tsx` and `apps/cli/src/commands/runtime/upgrade/index.tsx`

**Checkpoint**: Users can inspect upgrade drift and compatibility safely before mutating project-local state.

---

## Phase 5: User Story 3 - Repair or Migrate Existing Local State (Priority: P3)

**Goal**: Recover partially upgraded, degraded, or otherwise repairable `.mimirmesh` installations without wiping preserved project intelligence.

**Independent Test**: Use a repairable or partially interrupted `.mimirmesh` fixture, run `mimirmesh runtime upgrade repair`, and confirm the system resumes from checkpoints or repairs degraded assets while preserving compatible state and reporting blocked cases truthfully.

### Tests for User Story 3

- [x] T024 [P] [US3] Add repair, resume, and degraded preserved-asset coverage in `packages/runtime/src/upgrade/repair.test.ts`, `packages/testing/src/integration/runtime-upgrade-repair.test.ts`, and `tests/workflow/project-runtime-repair.test.ts`

### Implementation for User Story 3

- [x] T025 [P] [US3] Implement repair and checkpoint-resume orchestration in `packages/runtime/src/upgrade/repair.ts` and `packages/runtime/src/upgrade/checkpoints.ts`
- [x] T026 [P] [US3] Implement blocked-state and manual-intervention reporting in `packages/runtime/src/upgrade/status.ts` and `packages/runtime/src/upgrade/repair.ts`
- [x] T027 [US3] Implement the `mimirmesh runtime upgrade repair` command and CLI reporting in `apps/cli/src/commands/runtime/upgrade/repair.tsx` and `apps/cli/src/lib/context.ts`
- [x] T028 [US3] Wire degraded preserved-asset isolation into runtime readiness evidence in `packages/runtime/src/health/state.ts`, `packages/runtime/src/state/io.ts`, and `packages/runtime/src/services/runtime-lifecycle.ts`

**Checkpoint**: Repairable project-local states can be resumed or repaired without destructive reinstall, and blocked cases preserve state with clear guidance.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize documentation, regression coverage, and validation artifacts that span multiple stories.

- [x] T029 [P] Update runtime upgrade feature documentation in `docs/features/runtime-upgrade.md` and `docs/features/cli-command-surface.md`
- [x] T030 [P] Update runtime operations and runbook guidance in `docs/operations/runtime.md` and `docs/runbooks/first-init.md`
- [x] T031 Run the upgrade validation scenarios from `docs/specifications/002-safe-local-upgrade/quickstart.md` and record any observed command/output deltas in `docs/features/runtime-upgrade.md`
- [x] T032 [P] Extend shared regression coverage and fixture support in `packages/testing/src/integration/runtime-lifecycle.test.ts` and `packages/testing/src/fixtures/runtime-upgrade.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies and can start immediately.
- **Phase 2: Foundational**: Depends on Phase 1 and blocks all user story work.
- **Phase 3: User Story 1**: Depends on Phase 2 and delivers the MVP upgrade path.
- **Phase 4: User Story 2**: Depends on Phase 2 and can proceed after or alongside User Story 1 once foundational work is complete.
- **Phase 5: User Story 3**: Depends on Phase 2 and builds on the same upgrade state primitives; it can start after User Stories 1 and 2 stabilize their shared flows.
- **Phase 6: Polish**: Depends on the desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other user stories after Foundational phase completion.
- **User Story 2 (P2)**: No dependency on User Story 1 for status classification, but it benefits from the version evidence and migrate wiring introduced for US1.
- **User Story 3 (P3)**: Depends on the checkpoint, versioning, and degraded-state machinery established in Foundational and extended by US1 and US2.

### Within Each User Story

- Write tests for the story first and confirm they fail before implementation.
- Implement core runtime/package logic before CLI command wiring.
- Complete preserved-state validation and reporting before declaring the story done.

### Parallel Opportunities

- `T002` and `T003` can run in parallel after `T001`.
- `T005`, `T006`, `T007`, and `T008` can run in parallel after `T004`.
- `T011` and `T012` can run in parallel for US1.
- `T013` and `T014` can run in parallel for US1 before `T015` through `T018`.
- `T019` can run in parallel with US1 finishing work once Foundational phase is complete.
- `T020` and `T021` can run in parallel for US2 before CLI wiring.
- `T024` can run in parallel with US2 completion.
- `T025` and `T026` can run in parallel for US3 before CLI/reporting work.
- `T029`, `T030`, and `T032` can run in parallel during Polish.

---

## Parallel Example: User Story 1

```bash
# Launch the core US1 tests together:
Task: "Add migration planner and no-op upgrade coverage in packages/runtime/src/upgrade/planner.test.ts and packages/testing/src/integration/runtime-upgrade-noop.test.ts"
Task: "Add end-to-end in-place project upgrade coverage in tests/workflow/project-runtime-upgrade.test.ts"

# Launch the core US1 implementation work together:
Task: "Implement ordered migration planning and step execution in packages/runtime/src/upgrade/planner.ts and packages/runtime/src/upgrade/migrate.ts"
Task: "Implement drift-aware runtime reconciliation for compose, engine image, and bootstrap changes in packages/runtime/src/upgrade/reconcile.ts and packages/runtime/src/services/runtime-lifecycle.ts"
```

---

## Parallel Example: User Story 2

```bash
# Launch the US2 status logic and evidence persistence together:
Task: "Implement upgrade status classification and compatibility-window enforcement in packages/runtime/src/upgrade/status.ts and packages/runtime/src/upgrade/versioning.ts"
Task: "Persist project runtime version evidence during init, start, and reconcile flows in packages/runtime/src/upgrade/metadata.ts and packages/runtime/src/services/runtime-lifecycle.ts"
```

---

## Parallel Example: User Story 3

```bash
# Launch the US3 repair logic together:
Task: "Implement repair and checkpoint-resume orchestration in packages/runtime/src/upgrade/repair.ts and packages/runtime/src/upgrade/checkpoints.ts"
Task: "Implement blocked-state and manual-intervention reporting in packages/runtime/src/upgrade/status.ts and packages/runtime/src/upgrade/repair.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate the in-place migrate flow against a supported older `.mimirmesh` fixture before proceeding.

### Incremental Delivery

1. Deliver Setup + Foundational to establish versioning, checkpoints, backups, and compatibility rules.
2. Deliver User Story 1 to provide the core migrate flow.
3. Deliver User Story 2 to let users inspect upgrade drift and safety before mutation.
4. Deliver User Story 3 to recover degraded or partially upgraded project-local state.
5. Finish with docs and regression validation.

### Parallel Team Strategy

1. One engineer completes Phase 1 and coordinates Phase 2 shared primitives.
2. After Phase 2, one engineer can focus on US1 runtime reconciliation while another prepares US2 status/reporting work.
3. US3 can start once checkpoint and degraded-state behavior are stable enough to build repair flows on top.

---

## Notes

- [P] tasks target different files or isolated modules and can proceed in parallel.
- All user story tasks include exact repository paths so they are immediately executable.
- Tests are intentionally included because the feature request requires unit, integration, and workflow validation.
- Preserve monorepo boundaries: reusable logic belongs in `packages/*`, CLI surfaces belong in `apps/cli`, and docs updates belong in `docs/*`.
