# Tasks: Installer Wizard v2

**Input**: Design documents from `/docs/specifications/008-installer-wizard-v2/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/install-command.md, quickstart.md

**Tests**: Tests are included because the repository requires CLI, workflow, and package-level regression coverage for behavioral changes of this scope.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Phase 1: Setup (Shared Implementation Entry Points)

**Purpose**: Create the new umbrella install entry surfaces that the rest of the work will build on.

- [X] T001 Create the umbrella install command entry module in `apps/cli/src/commands/install/index.tsx`
- [X] T002 Create the umbrella install workflow module in `apps/cli/src/workflows/install.ts`
- [X] T003 [P] Create the install review UI shell in `apps/cli/src/ui/install-review.tsx`
- [X] T003a [P] Wire the install workflow into the existing TUI launcher surfaces in `apps/cli/src/ui/workflow-launchers.tsx`
- [X] T003b [P] Expose the install workflow in the dashboard navigation surface in `apps/cli/src/ui/dashboard-screen.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the shared installation policy/state/change-summary models and CLI wiring needed before any user story can be delivered.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T004 [P] Add installation preset, area, and policy types in `packages/installer/src/install-policy.ts`
- [X] T005 [P] Add installation state snapshot and change summary helpers in `packages/installer/src/install-state.ts`
- [X] T006 [P] Export installation policy/state helpers from `packages/installer/src/index.ts`
- [X] T007 [P] Add package tests for installation policy and state helpers in `packages/installer/tests/install-policy.test.ts`
- [X] T008 Extend CLI context with install-specific state detection and execution helpers in `apps/cli/src/lib/context.ts`
- [X] T009 Wire the umbrella install command into the CLI command surface in `apps/cli/src/cli.ts`
- [X] T010 Implement the base workflow definition, machine-readable payload shape, and shared step sequencing in `apps/cli/src/workflows/install.ts`
- [X] T011 Implement command-level prompt guards and option parsing for the install command in `apps/cli/src/commands/install/index.tsx`

**Checkpoint**: Installation policy/state modeling and command wiring are ready; user story work can begin.

---

## Phase 3: User Story 1 - Guided First-Time Install (Priority: P1) 🎯 MVP

**Goal**: Deliver a single guided `install` command that handles first-run onboarding, preset selection, and optional install areas in one flow.

**Independent Test**: Run `mimirmesh install` in an uninitialized repository, choose a preset and reviewed install areas, and verify that the project reaches a usable installed state with visible workflow output.

### Tests for User Story 1

- [X] T012 [P] [US1] Add guided install command rendering coverage in `apps/cli/tests/commands/install/index.test.tsx`
- [X] T013 [P] [US1] Add first-time install workflow coverage in `apps/cli/tests/workflows/install.test.ts`
- [X] T013a [P] [US1] Add progress-visibility and structured-output coverage for install in `apps/cli/tests/workflows/install.test.ts`
- [X] T013b [P] [US1] Add TUI and direct-command parity coverage for install state transitions in `tests/workflow/interactive-cli-guided-workflows.test.ts`
- [X] T014 [P] [US1] Add first-time install integration coverage in `tests/integration/install-flow.test.ts`

### Implementation for User Story 1

- [X] T015 [US1] Implement preset selection and per-area review flow in `apps/cli/src/commands/install/index.tsx`
- [X] T016 [US1] Compose docs scaffolding, runtime initialization, report generation, and readiness verification in `apps/cli/src/workflows/install.ts`
- [X] T016a [P] [US1] Add install runtime readiness and bootstrap verification coverage in `apps/cli/tests/workflows/install-runtime.test.ts`
- [X] T016b [P] [US1] Add live discovery and no-synthetic-tool regression coverage for install validation in `tests/integration/install-runtime-validation.test.ts`
- [X] T016c [US1] Extend the install workflow to surface degraded runtime root cause, affected capabilities, and corrective actions in `apps/cli/src/workflows/install.ts`
- [X] T016d [P] [US1] Add validation coverage verifying install classifies configuration-dependent runtime limits only after active-runtime validation, preserves local-first behavior, and reports any hosted fallback explicitly in `apps/cli/tests/workflows/install-runtime.test.ts`
- [X] T017 [US1] Integrate IDE target selection into the umbrella install flow in `apps/cli/src/workflows/install.ts`
- [X] T018 [US1] Integrate bundled skills selection and installation into the umbrella install flow in `apps/cli/src/workflows/install.ts`
- [X] T019 [US1] Update the install command contract to reflect first-run guided behavior in `docs/specifications/008-installer-wizard-v2/contracts/install-command.md`
- [X] T019a [US1] Update `docs/features/cli-command-surface.md` with observed install behavior, prerequisites, bootstrap flow, degraded outcomes, machine-readable mode behavior, and install-only onboarding guidance

**Checkpoint**: First-time guided onboarding works through `install` and is independently testable.

---

## Phase 4: User Story 2 - Reinstall or Repair Existing Setup (Priority: P2)

**Goal**: Make `install` state-aware so reruns can repair, complete, or confirm existing setup without duplicating valid work.

**Independent Test**: Run `mimirmesh install` in a partially installed repository, confirm detected state is surfaced, approve changes, and verify only missing or operator-approved updates are applied.

### Tests for User Story 2

- [X] T020 [P] [US2] Add rerun and state-detection workflow coverage in `apps/cli/tests/workflows/install-rerun.test.ts`
- [X] T021 [P] [US2] Add overwrite confirmation integration coverage in `tests/integration/install-overwrite-handling.test.ts`
- [X] T022 [P] [US2] Add idempotent rerun integration coverage in `tests/integration/install-idempotent-rerun.test.ts`

### Implementation for User Story 2

- [X] T023 [US2] Implement repository install state detection and area defaulting in `apps/cli/src/lib/context.ts`
- [X] T024 [US2] Implement install change summary rendering and overwrite confirmation in `apps/cli/src/ui/install-review.tsx`
- [X] T025 [US2] Implement rerun, repair, skip, and overwrite-confirmation behavior in `apps/cli/src/workflows/install.ts`
- [X] T026 [US2] Update the installation data model with any final rerun/repair field refinements in `docs/specifications/008-installer-wizard-v2/data-model.md`
- [X] T027 [US2] Update operator rerun guidance for the unified installer in `docs/runbooks/install.md`

**Checkpoint**: Rerun and repair flows are independently functional without duplicating already-correct install state.

---

## Phase 5: User Story 3 - Automation-Safe Install Execution (Priority: P3)

**Goal**: Make non-interactive execution deterministic and remove `init` and `setup` from the supported onboarding surface.

**Independent Test**: Run `mimirmesh install --non-interactive` with and without explicit selections, confirm safe failure/success behavior, and verify `init` and `setup` no longer appear as supported onboarding commands.

### Tests for User Story 3

- [X] T028 [P] [US3] Add non-interactive install guard coverage in `tests/workflow/interactive-cli-guided-workflows.test.ts`
- [X] T029 [P] [US3] Add onboarding command surface regression coverage in `tests/workflow/interactive-cli-direct-commands.test.ts`
- [X] T030 [P] [US3] Update end-to-end onboarding workflow coverage to use install-only onboarding in `tests/workflow/end-to-end.test.ts`

### Implementation for User Story 3

- [X] T031 [US3] Enforce explicit preset or per-area requirements for non-interactive install in `apps/cli/src/commands/install/index.tsx`
- [X] T031a [US3] Update install help text and command registration copy to describe canonical onboarding and non-interactive requirements in `apps/cli/src/cli.ts`
- [X] T031b [P] [US3] Add help-output and command-list regression coverage for install-only onboarding in `tests/workflow/interactive-cli-direct-commands.test.ts`
- [X] T031c [P] [US3] Add machine-readable opt-in and semantic-equivalence regression coverage for install in `tests/workflow/interactive-cli-direct-commands.test.ts`
- [X] T032 [US3] Remove the legacy init command entry point from `apps/cli/src/commands/init.tsx`
- [X] T033 [US3] Remove the legacy setup command entry point from `apps/cli/src/commands/setup.tsx`
- [X] T034 [US3] Update onboarding command documentation to remove init/setup and promote install in `README.md`
- [X] T036 [US3] Update interactive CLI feature specification references from init/setup to install in `docs/specifications/003-interactive-cli-experience/spec.md`
- [X] T037 [US3] Update interactive CLI feature quickstart references from init/setup to install in `docs/specifications/003-interactive-cli-experience/quickstart.md`
- [X] T038 [US3] Update interactive CLI data model references from init/setup to install in `docs/specifications/003-interactive-cli-experience/data-model.md`

**Checkpoint**: Automation-safe install behavior and legacy command removal are independently validated.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, validation, and documentation alignment across the feature.

- [X] T039 [P] Refresh the feature quickstart with final command examples, visible progress state checks, TUI and direct-command parity checks, and machine-readable mode validation in `docs/specifications/008-installer-wizard-v2/quickstart.md`
- [X] T040 [P] Sync the final install command contract and payload details in `docs/specifications/008-installer-wizard-v2/contracts/install-command.md`
- [X] T041 [P] [Support] Sync the final implementation notes and decisions in `docs/specifications/008-installer-wizard-v2/plan.md`
- [X] T042 [P] [Support] Record validation-derived behavioral deltas in `docs/specifications/008-installer-wizard-v2/research.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies; start immediately.
- **Phase 2: Foundational**: Depends on Phase 1; blocks all user stories.
- **Phase 3: User Story 1**: Depends on Phase 2 completion.
- **Phase 4: User Story 2**: Depends on Phase 2 completion and can begin after US1 scaffolds the umbrella install flow.
- **Phase 5: User Story 3**: Depends on Phase 2 completion and should land after the install command exists.
- **Phase 6: Polish**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: First deliverable and MVP.
- **US2 (P2)**: Depends on the umbrella install flow from US1, but remains independently testable as a rerun/repair slice.
- **US3 (P3)**: Depends on the umbrella install flow from US1, but remains independently testable as automation-safe behavior and command-surface cleanup.

### Within Each User Story

- Add tests before or alongside the corresponding implementation tasks and confirm they cover the intended regression.
- Implement command prompt resolution before workflow execution semantics.
- Implement workflow behavior before documentation sync for that story.
- Complete and validate each story before moving to the next priority when working sequentially.

### Parallel Opportunities

- `T003`, `T003a`, `T003b`, `T004`, `T005`, `T006`, and `T007` can run in parallel once Phase 1 starts.
- User-story tests marked `[P]` can run in parallel within their phase.
- Documentation updates within US3 marked by separate files can be split across contributors.
- Phase 6 sync tasks can run in parallel after implementation stabilizes.

## Parallel Example: User Story 1

```bash
# Parallelize first-run install coverage
Task: T012 Add guided install command rendering coverage in apps/cli/tests/commands/install/index.test.tsx
Task: T013 Add first-time install workflow coverage in apps/cli/tests/workflows/install.test.ts
Task: T013a Add progress-visibility and structured-output coverage for install in apps/cli/tests/workflows/install.test.ts
Task: T013b Add TUI and direct-command parity coverage for install state transitions in tests/workflow/interactive-cli-guided-workflows.test.ts
Task: T014 Add first-time install integration coverage in tests/integration/install-flow.test.ts

# Parallelize first-run implementation slices after tests exist
Task: T016a Add install runtime readiness and bootstrap verification coverage in apps/cli/tests/workflows/install-runtime.test.ts
Task: T016b Add live discovery and no-synthetic-tool regression coverage for install validation in tests/integration/install-runtime-validation.test.ts
Task: T019a Update docs/features/cli-command-surface.md with observed install behavior, prerequisites, bootstrap flow, degraded outcomes, machine-readable mode behavior, and install-only onboarding guidance
Task: T017 Integrate IDE target selection into the umbrella install flow in apps/cli/src/workflows/install.ts
Task: T018 Integrate bundled skills selection and installation into the umbrella install flow in apps/cli/src/workflows/install.ts
```

## Parallel Example: User Story 2

```bash
# Parallelize rerun/repair coverage
Task: T020 Add rerun and state-detection workflow coverage in apps/cli/tests/workflows/install-rerun.test.ts
Task: T021 Add overwrite confirmation integration coverage in tests/integration/install-overwrite-handling.test.ts
Task: T022 Add idempotent rerun integration coverage in tests/integration/install-idempotent-rerun.test.ts
```

## Parallel Example: User Story 3

```bash
# Parallelize automation and command-surface regressions
Task: T028 Add non-interactive install guard coverage in tests/workflow/interactive-cli-guided-workflows.test.ts
Task: T029 Add onboarding command surface regression coverage in tests/workflow/interactive-cli-direct-commands.test.ts
Task: T030 Update end-to-end onboarding workflow coverage to use install-only onboarding in tests/workflow/end-to-end.test.ts
Task: T031b Add help-output and command-list regression coverage for install-only onboarding in tests/workflow/interactive-cli-direct-commands.test.ts
Task: T031c Add machine-readable opt-in and semantic-equivalence regression coverage for install in tests/workflow/interactive-cli-direct-commands.test.ts

# Parallelize command-surface documentation cleanup
Task: T034 Update onboarding command documentation to remove init/setup and promote install in README.md
Task: T036 Update interactive CLI feature specification references from init/setup to install in docs/specifications/003-interactive-cli-experience/spec.md
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate `mimirmesh install` in an uninitialized repository.
4. Stop and confirm the new onboarding flow is viable before expanding rerun/automation behavior.

### Incremental Delivery

1. Deliver US1 to establish the umbrella install flow.
2. Add US2 to make reruns and repairs safe and idempotent.
3. Add US3 to harden automation behavior and remove the old command surface.
4. Finish with Phase 6 sync and validation artifacts.

### Parallel Team Strategy

1. One contributor handles foundational policy/state models and CLI wiring.
2. After the foundational phase, one contributor can implement US1 workflow behavior while another prepares US2 rerun tests and a third stages US3 doc/test cleanup.
3. Rejoin for command-surface cleanup and final validation once the umbrella install flow is stable.

## Notes

- `[P]` means the task can run in parallel because it targets different files or independent validations.
- `[US1]`, `[US2]`, and `[US3]` map each task back to the corresponding independently testable story.
- The quickstart and contract artifacts remain part of the deliverable and must stay aligned with observed implementation behavior.
