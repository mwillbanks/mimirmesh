# Tasks: Interactive CLI Experience

**Input**: Design documents from `/docs/specifications/003-interactive-cli-experience/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are required for this feature because the request and plan explicitly require package-local UI tests, app-level CLI rendering tests, and workflow validation.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after shared prerequisites are complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Every task includes exact file paths

## Phase 1: Setup (Shared Scaffolding)

**Purpose**: Create the checked-in CLI UX surface and test entry points before shared behavior work begins.

- [ ] T001 Create the shared CLI UX entrypoints in `packages/ui/src/index.ts` and `apps/cli/src/ui/index.ts`
- [ ] T002 [P] Create workflow validation scaffolds in `tests/workflow/interactive-cli-entry.test.ts`, `tests/workflow/interactive-cli-direct-commands.test.ts`, and `tests/workflow/interactive-cli-guided-workflows.test.ts`
- [ ] T003 [P] Create app and package test scaffolds in `apps/cli/src/commands/index.test.tsx`, `apps/cli/src/lib/command-runner.test.tsx`, `apps/cli/src/commands/install/ide.test.tsx`, `apps/cli/src/commands/runtime/upgrade/repair.test.tsx`, `packages/ui/src/hooks/use-workflow-run.test.ts`, and `packages/ui/src/components/terminal-outcome.test.tsx`

---

## Phase 2: Core Prerequisites (Blocking Work)

**Purpose**: Build the shared workflow state, presentation, and automation guardrails that every CLI surface depends on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T004 Define the shared workflow state and terminal outcome types in `packages/ui/src/workflow/types.ts`
- [ ] T005 Implement the shared workflow state hook in `packages/ui/src/hooks/use-workflow-run.ts`
- [ ] T006 [P] Implement shell layout and compact-terminal fallback primitives in `packages/ui/src/components/shell-frame.tsx` and `packages/ui/src/components/compact-terminal-notice.tsx`
- [ ] T007 [P] Implement reusable step history and terminal outcome components in `packages/ui/src/components/workflow-step-list.tsx` and `packages/ui/src/components/terminal-outcome.tsx`
- [ ] T008 [P] Upgrade the base state messaging primitives for explicit labels, non-color cues, and reduced-motion-safe progress in `packages/ui/src/components/state-message.tsx`, `packages/ui/src/components/spinner-line.tsx`, and `packages/ui/src/patterns/task-status-view.tsx`
- [ ] T009 Implement shared workflow-state adapters for initialization and runtime flows in `apps/cli/src/workflows/init.ts`, `apps/cli/src/workflows/runtime.ts`, and `apps/cli/src/lib/context.ts`
- [ ] T010 Implement runtime bootstrap/index verification, readiness checkpoints, degraded diagnostics, blocked-capability reporting, and observed-state evidence mapping in `apps/cli/src/workflows/runtime.ts` and `apps/cli/src/lib/context.ts`
- [ ] T011 Implement CLI presentation mode parsing and interactive-context detection in `apps/cli/src/lib/presentation.ts` and `apps/cli/src/lib/non-interactive.ts`
- [ ] T012 Implement machine-readable serialization with shared outcome parity in `apps/cli/src/lib/machine-readable.ts`
- [ ] T013 Replace the coarse command runner with shared step-based rendering in `apps/cli/src/lib/command-runner.tsx`
- [ ] T014 Remove raw fallback object dumping and route fallback output through the new presentation layer in `apps/cli/src/fallback.ts` and `apps/cli/src/lib/command-runner.tsx`
- [ ] T015 [P] Add shared UI and orchestration behavior tests for workflow state, outcome rendering, bootstrap/index verification, and readiness evidence in `packages/ui/src/hooks/use-workflow-run.test.ts`, `packages/ui/src/components/terminal-outcome.test.tsx`, `apps/cli/src/lib/command-runner.test.tsx`, `apps/cli/src/workflows/init.test.ts`, and `apps/cli/src/workflows/runtime.test.ts`

**Checkpoint**: Shared workflow state, rendering, and automation behavior are ready for story work.

---

## Phase 3: User Story 1 - Launch and Navigate the Product from the TUI (Priority: P1) 🎯 MVP

**Goal**: Make bare `mimirmesh` launch a full-screen shell that exposes the primary product areas and current project state.

**Independent Test**: Launch `mimirmesh`, navigate the shell with keyboard-only input, open the core workflow areas, and confirm the shell exposes current status plus discoverable launch paths for lower-frequency surfaces.

### Tests for User Story 1

- [ ] T016 [P] [US1] Add bare-command render coverage for the shell entry surface in `apps/cli/src/commands/index.test.tsx`
- [ ] T017 [P] [US1] Add workflow validation for full-screen shell entry and primary navigation in `tests/workflow/interactive-cli-entry.test.ts`

### Implementation for User Story 1

- [ ] T018 [P] [US1] Implement the dashboard and home shell screen in `apps/cli/src/ui/dashboard-screen.tsx`
- [ ] T019 [P] [US1] Implement the shared navigation model and workflow cards in `apps/cli/src/ui/navigation.tsx` and `apps/cli/src/ui/workflow-card.tsx`
- [ ] T020 [P] [US1] Implement embedded launchers for setup/init, runtime control, upgrade/repair, and MCP inspection in `apps/cli/src/ui/workflow-launchers.tsx`
- [ ] T021 [US1] Replace the default status command with the full-screen shell in `apps/cli/src/commands/index.tsx`
- [ ] T022 [US1] Add compact-terminal guidance and discoverable handoffs for configuration, reports, notes, and integration tasks in `apps/cli/src/ui/compact-shell.tsx` and `apps/cli/src/commands/index.tsx`
- [ ] T023 [US1] Wire keyboard-first navigation, reduced-motion behavior, and explicit state labels through the shell in `apps/cli/src/ui/dashboard-screen.tsx`, `apps/cli/src/ui/navigation.tsx`, and `packages/ui/src/components/shell-frame.tsx`

**Checkpoint**: Bare `mimirmesh` is a navigable full-screen shell and can be validated independently.

---

## Phase 4: User Story 2 - Run Direct Commands with Rich Human Feedback (Priority: P2)

**Goal**: Convert direct commands from coarse/raw output into shared human-readable workflow presentations with explicit machine-readable opt-in.

**Independent Test**: Run representative direct commands across init, runtime, upgrade, MCP, doctor, and lower-frequency command-first areas, and confirm step progress, outcome summaries, and explicit machine-readable parity.

### Tests for User Story 2

- [ ] T024 [P] [US2] Add app-level regression coverage for step-based direct command rendering in `apps/cli/src/lib/command-runner.test.tsx`
- [ ] T025 [P] [US2] Add workflow validation for rich direct-command progress and degraded outcomes in `tests/workflow/interactive-cli-direct-commands.test.ts`
- [ ] T026 [P] [US2] Add machine-readable contract coverage in `apps/cli/src/lib/machine-readable.test.ts`

### Implementation for User Story 2

- [ ] T027 [P] [US2] Refactor setup and initialization command flows onto the shared workflow renderer in `apps/cli/src/commands/init.tsx`, `apps/cli/src/commands/setup.tsx`, `apps/cli/src/commands/refresh.tsx`, and `apps/cli/src/commands/update.tsx`
- [ ] T028 [P] [US2] Refactor runtime lifecycle commands onto the shared workflow renderer in `apps/cli/src/commands/runtime/start.tsx`, `apps/cli/src/commands/runtime/stop.tsx`, `apps/cli/src/commands/runtime/restart.tsx`, `apps/cli/src/commands/runtime/refresh.tsx`, `apps/cli/src/commands/runtime/status.tsx`, and `apps/cli/src/commands/runtime/doctor.tsx`
- [ ] T029 [P] [US2] Refactor runtime upgrade commands onto the shared workflow renderer in `apps/cli/src/commands/runtime/upgrade/index.tsx`, `apps/cli/src/commands/runtime/upgrade/status.tsx`, `apps/cli/src/commands/runtime/upgrade/migrate.tsx`, and `apps/cli/src/commands/runtime/upgrade/repair.tsx`
- [ ] T030 [P] [US2] Refactor MCP, doctor, and upgrade entry commands onto the shared workflow renderer in `apps/cli/src/commands/mcp/list-tools.tsx`, `apps/cli/src/commands/mcp/tool.tsx`, `apps/cli/src/commands/doctor.tsx`, and `apps/cli/src/commands/upgrade.tsx`
- [ ] T031 [P] [US2] Refactor lower-frequency command-first surfaces onto shared human-readable rendering in `apps/cli/src/commands/config/get.tsx`, `apps/cli/src/commands/config/set.tsx`, `apps/cli/src/commands/config/enable.tsx`, `apps/cli/src/commands/config/disable.tsx`, `apps/cli/src/commands/config/validate.tsx`, `apps/cli/src/commands/report/generate.tsx`, `apps/cli/src/commands/report/show.tsx`, `apps/cli/src/commands/note/add.tsx`, `apps/cli/src/commands/note/list.tsx`, `apps/cli/src/commands/note/search.tsx`, `apps/cli/src/commands/document/add.tsx`, `apps/cli/src/commands/speckit/init.tsx`, `apps/cli/src/commands/speckit/status.tsx`, and `apps/cli/src/commands/speckit/doctor.tsx`
- [ ] T032 [US2] Add explicit machine-readable mode parsing and semantic parity for eligible direct commands in `apps/cli/src/cli.ts`, `apps/cli/src/lib/machine-readable.ts`, and the affected command files under `apps/cli/src/commands/`
- [ ] T033 [US2] Preserve non-interactive defaults for inspection/status flows and standardize `success`/`degraded`/`failed` summaries in `apps/cli/src/lib/non-interactive.ts`, `apps/cli/src/commands/runtime/status.tsx`, `apps/cli/src/commands/runtime/upgrade/status.tsx`, `apps/cli/src/commands/mcp/list-tools.tsx`, and `apps/cli/src/workflows/runtime.ts`

**Checkpoint**: Direct commands are independently functional with shared progress and outcome semantics.

---

## Phase 5: User Story 3 - Guided and Safe Operational Workflows (Priority: P3)

**Goal**: Add prompt-driven choices, confirmations, and automation-safe alternatives for sensitive mutating workflows.

**Independent Test**: Run guided mutating workflows in interactive and non-interactive terminal contexts and confirm prompts explain consequences, provide safe defaults, and reject unusable prompt flows unless explicit automation flags are provided.

### Tests for User Story 3

- [ ] T034 [P] [US3] Add guided prompt coverage for IDE install, consequential config mutation, and repair flows in `apps/cli/src/commands/install/ide.test.tsx`, `apps/cli/src/commands/config/enable.test.tsx`, `apps/cli/src/commands/config/disable.test.tsx`, `apps/cli/src/commands/config/set.test.tsx`, and `apps/cli/src/commands/runtime/upgrade/repair.test.tsx`
- [ ] T035 [P] [US3] Add workflow validation for guided prompts, automation-safe fallbacks, and degraded outcomes in `tests/workflow/interactive-cli-guided-workflows.test.ts`

### Implementation for User Story 3

- [ ] T036 [P] [US3] Implement shared guided prompt primitives and consequence text helpers in `packages/ui/src/components/guided-confirm.tsx`, `packages/ui/src/components/guided-select.tsx`, and `packages/ui/src/components/prompt-reason.tsx`
- [ ] T037 [P] [US3] Refactor IDE installation and init-time IDE selection onto shared guided prompts in `apps/cli/src/commands/install/ide.tsx` and `apps/cli/src/commands/init.tsx`
- [ ] T038 [P] [US3] Add guided repair, upgrade, and runtime control prompts with explicit automation alternatives in `apps/cli/src/commands/runtime/upgrade/repair.tsx`, `apps/cli/src/commands/runtime/upgrade/migrate.tsx`, `apps/cli/src/commands/runtime/start.tsx`, `apps/cli/src/commands/runtime/stop.tsx`, and `apps/cli/src/workflows/runtime.ts`
- [ ] T039 [P] [US3] Add guided MCP action selection and consequential config mutation prompts with explicit automation alternatives in `apps/cli/src/ui/workflow-launchers.tsx`, `apps/cli/src/commands/mcp/tool.tsx`, `apps/cli/src/commands/config/enable.tsx`, `apps/cli/src/commands/config/disable.tsx`, and `apps/cli/src/commands/config/set.tsx`
- [ ] T040 [US3] Enforce prompt policy for non-interactive terminals and explicit non-interactive flags in `apps/cli/src/lib/non-interactive.ts`, `apps/cli/src/lib/presentation.ts`, `apps/cli/src/cli.ts`, `apps/cli/src/workflows/runtime.ts`, `apps/cli/src/commands/config/enable.tsx`, `apps/cli/src/commands/config/disable.tsx`, and `apps/cli/src/commands/config/set.tsx`

**Checkpoint**: Guided mutating workflows are independently functional and safe in both interactive and automation-sensitive contexts.

---

## Phase 6: Polish & Cross-Cutting Validation

**Purpose**: Finish accessibility, documentation, and regression validation across the entire CLI surface.

- [ ] T041 [P] Refine accessibility wording and non-color status cues across shared CLI components in `packages/ui/src/components/state-message.tsx`, `packages/ui/src/components/terminal-outcome.tsx`, and `apps/cli/src/ui/dashboard-screen.tsx`
- [ ] T042 [P] Update CLI behavior documentation in `docs/features/cli-command-surface.md`, `docs/features/mcp-client.md`, `docs/features/mcp-server.md`, `docs/features/runtime-upgrade.md`, `docs/operations/runtime.md`, and `README.md`
- [ ] T043 Run quickstart-aligned workflow regression coverage, including bootstrap/index verification and readiness truth, in `tests/workflow/end-to-end.test.ts`, `tests/workflow/project-runtime-repair.test.ts`, `tests/workflow/project-runtime-upgrade.test.ts`, `tests/workflow/interactive-cli-entry.test.ts`, `tests/workflow/interactive-cli-direct-commands.test.ts`, and `tests/workflow/interactive-cli-guided-workflows.test.ts`
- [ ] T044 Verify the documented shell scope, prompt policy, degraded outcomes, runtime prerequisites, and machine-readable behavior against `docs/specifications/003-interactive-cli-experience/quickstart.md`, `docs/features/cli-command-surface.md`, `docs/features/mcp-client.md`, `docs/features/mcp-server.md`, and `docs/features/runtime-upgrade.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Core Prerequisites (Phase 2)**: Depends on Setup completion and blocks all user story work.
- **User Story 1 (Phase 3)**: Depends on Core Prerequisites.
- **User Story 2 (Phase 4)**: Depends on Core Prerequisites and can proceed in parallel with User Story 1 once shared workflow primitives are complete.
- **User Story 3 (Phase 5)**: Depends on User Story 1 and User Story 2 because guided flows reuse both the shell navigation model and the richer direct-command presentation layer.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories after Phase 2.
- **User Story 2 (P2)**: No dependency on User Story 1 after Phase 2, but it must share the foundational workflow model.
- **User Story 3 (P3)**: Requires the shell entry points from User Story 1 and the shared direct-command rendering from User Story 2.

### Within Each User Story

- Write the listed tests before implementation tasks in that story.
- Shared workflow types and presentation helpers before command wiring.
- Shell navigation before dashboard launch integration.
- Presentation mode and automation guards before prompt-enabled mutating flows.
- Complete each story checkpoint before treating the story as done.

### Parallel Opportunities

- `T002` and `T003` can run in parallel after `T001`.
- `T006`, `T007`, and `T008` can run in parallel after `T004` starts.
- `T016` and `T017` can run in parallel.
- `T024`, `T025`, and `T026` can run in parallel.
- `T027` through `T031` can be split across engineers because they touch different command families.
- `T034` and `T035` can run in parallel.
- `T041` and `T042` can run in parallel near the end.

---

## Parallel Example: User Story 1

```bash
# Launch shell-entry validation work together:
Task: "Add bare-command render coverage for the shell entry surface in apps/cli/src/commands/index.test.tsx"
Task: "Add workflow validation for full-screen shell entry and primary navigation in tests/workflow/interactive-cli-entry.test.ts"

# Build the shell presentation pieces together:
Task: "Implement the dashboard and home shell screen in apps/cli/src/ui/dashboard-screen.tsx"
Task: "Implement the shared navigation model and workflow cards in apps/cli/src/ui/navigation.tsx and apps/cli/src/ui/workflow-card.tsx"
Task: "Implement embedded launchers for setup/init, runtime control, upgrade/repair, and MCP inspection in apps/cli/src/ui/workflow-launchers.tsx"
```

---

## Parallel Example: User Story 2

```bash
# Launch direct-command regression work together:
Task: "Add app-level regression coverage for step-based direct command rendering in apps/cli/src/lib/command-runner.test.tsx"
Task: "Add workflow validation for rich direct-command progress and degraded outcomes in tests/workflow/interactive-cli-direct-commands.test.ts"
Task: "Add machine-readable contract coverage in apps/cli/src/lib/machine-readable.test.ts"

# Split command-family refactors across the team:
Task: "Refactor setup and initialization command flows onto the shared workflow renderer in apps/cli/src/commands/init.tsx, apps/cli/src/commands/setup.tsx, apps/cli/src/commands/refresh.tsx, and apps/cli/src/commands/update.tsx"
Task: "Refactor runtime lifecycle commands onto the shared workflow renderer in apps/cli/src/commands/runtime/start.tsx, apps/cli/src/commands/runtime/stop.tsx, apps/cli/src/commands/runtime/restart.tsx, apps/cli/src/commands/runtime/refresh.tsx, apps/cli/src/commands/runtime/status.tsx, and apps/cli/src/commands/runtime/doctor.tsx"
Task: "Refactor lower-frequency command-first surfaces onto shared human-readable rendering in apps/cli/src/commands/config/get.tsx, apps/cli/src/commands/config/set.tsx, apps/cli/src/commands/config/enable.tsx, apps/cli/src/commands/config/disable.tsx, apps/cli/src/commands/config/validate.tsx, apps/cli/src/commands/report/generate.tsx, apps/cli/src/commands/report/show.tsx, apps/cli/src/commands/note/add.tsx, apps/cli/src/commands/note/list.tsx, apps/cli/src/commands/note/search.tsx, apps/cli/src/commands/document/add.tsx, apps/cli/src/commands/speckit/init.tsx, apps/cli/src/commands/speckit/status.tsx, and apps/cli/src/commands/speckit/doctor.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete User Story 1.
3. Validate bare `mimirmesh` shell entry with the User Story 1 tests.
4. Use that validated shell as the base for the remaining command-family work.

### Incremental Delivery

1. Finish Setup and Core Prerequisites to establish the shared workflow model.
2. Deliver User Story 1 to make the default shell usable.
3. Deliver User Story 2 to bring direct commands up to the same operator standard.
4. Deliver User Story 3 to add guided mutating flows and automation-safe prompt policy.
5. Finish Phase 6 documentation and regression validation before considering the feature complete.

### Parallel Team Strategy

1. One engineer handles Phase 2 workflow primitives and CLI mode parsing.
2. After Phase 2 completes:
   Engineer A: User Story 1 shell entry and navigation.
   Engineer B: User Story 2 direct-command refactors.
3. Once User Story 1 and User Story 2 are stable:
   Engineer C: User Story 3 guided prompts and automation guardrails.
4. Finish with shared docs and workflow regression validation in Phase 6.

---

## Notes

- `[P]` tasks touch different files and do not depend on incomplete work.
- User story labels trace each task back to the prioritized stories in `spec.md`.
- The feature is not complete until the shell, direct commands, guided prompts, machine-readable parity, docs, and workflow validation all pass.
- `docs/features/*` and `README.md` must describe observed operator-visible behavior, not intended behavior.