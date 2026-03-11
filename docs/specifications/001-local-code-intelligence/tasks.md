# Tasks: Srclight Runtime Replacement

**Input**: Design documents from `/docs/specifications/001-local-code-intelligence/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are required for this feature because the request explicitly requires package-local tests, engine integration tests, and workflow validation.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after shared prerequisites are complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Every task includes exact file paths

## Phase 1: Setup (Shared Scaffolding)

**Purpose**: Create the checked-in Srclight integration surface and wire up the initial file structure.

- [X] T001 Create the checked-in Srclight runtime image in `docker/images/srclight/Dockerfile`
- [X] T002 [P] Create the Srclight adapter scaffold in `packages/mcp-adapters/srclight/src/index.ts`, `packages/mcp-adapters/srclight/src/config.ts`, `packages/mcp-adapters/srclight/src/routing.ts`, `packages/mcp-adapters/srclight/src/bootstrap.ts`, and `packages/mcp-adapters/srclight/src/types.ts`
- [X] T003 [P] Prepare runtime asset copying for the checked-in engine image and bridge asset in `packages/runtime/src/images/materialize.ts` and `docker/images/common/engine-bridge.mjs`
- [X] T004 [P] Add the `srclight` engine identifier to CLI config toggles in `apps/cli/src/commands/config/enable.tsx` and `apps/cli/src/commands/config/disable.tsx`

---

## Phase 2: Core Prerequisites (Blocking Work)

**Purpose**: Complete the shared runtime, config, and bridge changes that all stories depend on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T005 Replace the `codebrain` engine schema with `srclight` in `packages/config/src/schema/index.ts`
- [X] T006 Update the default engine configuration, mount paths, and optional embedding settings for Srclight in `packages/config/src/defaults/index.ts`
- [X] T007 Register the Srclight adapter and remove codebrain adapter wiring in `packages/mcp-adapters/src/index.ts` and delete `packages/mcp-adapters/codebrain/src/index.ts`
- [X] T008 Extend adapter/runtime contracts for transport-aware engines and command-based bootstrap in `packages/mcp-adapters/src/types.ts` and `packages/runtime/src/types/index.ts`
- [X] T009 Implement upstream Streamable HTTP and SSE bridge connectivity in `docker/images/common/engine-bridge.mjs` and `packages/runtime/src/images/materialize.ts`
- [X] T010 Update engine command selection and compose rendering for `mm-srclight` in `packages/runtime/src/images/engine-images.ts` and `packages/runtime/src/compose/render.ts`
- [X] T011 Implement command-based bootstrap execution and readiness gating for native `srclight index` in `packages/runtime/src/bootstrap/run.ts` and `packages/runtime/src/services/runtime-lifecycle.ts`
- [X] T012 Remove codebrain-specific runtime image branches and checked-in assets in `packages/runtime/src/images/materialize.ts`, `packages/runtime/src/images/engine-images.ts`, `docker/images/codebrain/Dockerfile`, and `docker/images/codebrain/entrypoint.sh`
- [X] T013 [P] Update core schema and runtime regression tests for the new engine model in `packages/config/src/schema/config.test.ts`, `packages/runtime/src/discovery/discover.test.ts`, `packages/runtime/src/compose/render.test.ts`, and `packages/runtime/src/health/compose.test.ts`

**Checkpoint**: Shared runtime/config work is complete; story work can proceed independently.

---

## Phase 3: User Story 1 - Reliable Repository Intelligence For Agents (Priority: P1)

**Goal**: Make Srclight the preferred code-intelligence engine for unified and passthrough MCP queries.

**Independent Test**: Start the runtime, then verify `search_code`, `find_symbol`, and `trace_dependency` route to Srclight and that `mimirmesh.srclight.*` passthrough tools return live results.

### Tests for User Story 1

- [X] T014 [P] [US1] Add Srclight adapter config and routing tests in `packages/mcp-adapters/srclight/src/config.test.ts` and `packages/mcp-adapters/srclight/src/routing.test.ts`
- [X] T015 [P] [US1] Update unified routing and router tests for Srclight priority and passthrough namespace in `packages/mcp-core/src/routing/table.test.ts` and `packages/mcp-core/src/registry/router.test.ts`
- [X] T016 [P] [US1] Update MCP integration coverage for Srclight-backed unified and passthrough queries in `packages/testing/src/integration/mcp-integration.test.ts`

### Implementation for User Story 1

- [X] T017 [US1] Implement Srclight config translation and validation in `packages/mcp-adapters/srclight/src/config.ts` and `packages/mcp-adapters/srclight/src/types.ts`
- [X] T018 [US1] Implement live Srclight unified route resolution in `packages/mcp-adapters/srclight/src/routing.ts`
- [X] T019 [US1] Implement Srclight adapter registration, passthrough input shaping, and unified execution hooks in `packages/mcp-adapters/srclight/src/index.ts` and `packages/mcp-adapters/src/types.ts`
- [X] T020 [US1] Update discovery-backed routing precedence to prefer Srclight for code-intelligence unified tools in `packages/runtime/src/discovery/discover.ts` and `packages/mcp-core/src/routing/table.test.ts`

**Checkpoint**: Srclight-backed unified and passthrough code-intelligence flows are independently functional.

---

## Phase 4: User Story 2 - Automatic Runtime Provisioning And Readiness (Priority: P2)

**Goal**: Ensure Srclight builds, starts, indexes, and reports truthful health automatically during runtime startup.

**Independent Test**: Start the runtime on a clean fixture repository and confirm the Srclight image builds, the service starts, native indexing completes, readiness becomes healthy only after bootstrap success, and embedding-specific failures degrade only semantic capabilities.

### Tests for User Story 2

- [X] T021 [P] [US2] Add engine integration coverage for Srclight image build, startup, discovery, and bootstrap in `packages/testing/src/integration/engines.test.ts` and `packages/testing/src/integration/runtime-lifecycle.test.ts`
- [X] T022 [P] [US2] Add bridge transport and reconnect regression tests for upstream HTTP/SSE behavior in `packages/mcp-core/src/transport/bridge.test.ts` and `packages/runtime/src/discovery/discover.test.ts`

### Implementation for User Story 2

- [X] T023 [US2] Implement the checked-in Srclight image build and runtime asset synchronization in `docker/images/srclight/Dockerfile` and `packages/runtime/src/images/materialize.ts`
- [X] T024 [US2] Implement Srclight compose rendering, service env translation, and startup command selection in `packages/runtime/src/compose/render.ts`, `packages/runtime/src/images/engine-images.ts`, and `packages/mcp-adapters/srclight/src/config.ts`
- [X] T025 [US2] Implement native `srclight index` bootstrap arguments with optional `--embed` support in `packages/mcp-adapters/srclight/src/bootstrap.ts` and `packages/runtime/src/bootstrap/run.ts`
- [X] T026 [US2] Implement runtime health classification for base engine failures versus embedding-only degradation in `packages/runtime/src/services/runtime-lifecycle.ts` and `packages/runtime/src/types/index.ts`
- [X] T027 [US2] Persist Srclight runtime state and readiness evidence while respecting repo-local `.srclight/` data in `packages/runtime/src/state/io.ts` and `packages/runtime/src/services/runtime-lifecycle.ts`

**Checkpoint**: Runtime startup and status are independently truthful for Srclight build, discovery, bootstrap, and degraded behavior.

---

## Phase 5: User Story 3 - Accurate Client And Server Runtime Documentation (Priority: P3)

**Goal**: Document the observed Srclight runtime behavior for the MCP server and MCP client surfaces.

**Independent Test**: Validate the live runtime, then confirm the feature docs match the observed Srclight startup path, transport mode, indexing behavior, passthrough exposure, unified routing, and degraded outcomes.

### Tests for User Story 3

- [X] T028 [P] [US3] Add workflow validation for Srclight-backed CLI, server, and client behavior in `tests/workflow/end-to-end.test.ts`

### Implementation for User Story 3

- [X] T029 [US3] Update server runtime documentation for Srclight startup, SSE bridge mode, indexing bootstrap, optional embeddings, and degraded states in `docs/features/mcp-server.md`
- [X] T030 [US3] Update client runtime documentation for Srclight unified routing, passthrough names, and validated tool behavior in `docs/features/mcp-client.md`
- [X] T031 [US3] Record the validated Srclight verification flow in `docs/specifications/001-local-code-intelligence/quickstart.md`

**Checkpoint**: Runtime-facing docs are independently accurate for the Srclight integration.

---

## Phase 6: Polish & Cross-Cutting Validation

**Purpose**: Finish deletion cleanup, run the required validations, and verify the docs match the observed runtime.

- [X] T032 [P] Remove lingering codebrain references from runtime-facing and integration surfaces in `packages/testing/src/integration/engines.test.ts`, `packages/testing/src/integration/mcp-integration.test.ts`, and `tests/workflow/end-to-end.test.ts`
- [X] T033 Run package-local test suites for config, adapter, runtime, and routing changes in `packages/config/src/schema/config.test.ts`, `packages/mcp-adapters/srclight/src/config.test.ts`, `packages/mcp-adapters/srclight/src/routing.test.ts`, `packages/runtime/src/discovery/discover.test.ts`, `packages/runtime/src/compose/render.test.ts`, `packages/runtime/src/health/compose.test.ts`, `packages/mcp-core/src/routing/table.test.ts`, and `packages/mcp-core/src/transport/bridge.test.ts`
- [X] T034 Run engine integration, MCP integration, and workflow validation for Srclight in `packages/testing/src/integration/engines.test.ts`, `packages/testing/src/integration/runtime-lifecycle.test.ts`, `packages/testing/src/integration/mcp-integration.test.ts`, and `tests/workflow/end-to-end.test.ts`
- [X] T035 Verify `docs/features/mcp-server.md` and `docs/features/mcp-client.md` against the observed Srclight runtime output captured through `docs/specifications/001-local-code-intelligence/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Core Prerequisites (Phase 2)**: Depends on Setup completion and blocks all user story work.
- **User Story 1 (Phase 3)**: Depends on Core Prerequisites.
- **User Story 2 (Phase 4)**: Depends on Core Prerequisites; can proceed in parallel with User Story 1 once shared runtime work is complete.
- **User Story 3 (Phase 5)**: Depends on User Story 1 and User Story 2 because the docs must reflect validated runtime behavior.
- **Polish (Phase 6)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories after Phase 2.
- **User Story 2 (P2)**: No dependency on User Story 1 after Phase 2, but its runtime behavior enables final validation for docs.
- **User Story 3 (P3)**: Requires validated behavior from User Story 1 and User Story 2.

### Within Each User Story

- Write and update the listed tests before implementation tasks in that story.
- Config/runtime contracts before adapter behavior.
- Adapter behavior before integration validation.
- Runtime validation before docs finalization.

### Parallel Opportunities

- `T002`, `T003`, and `T004` can run in parallel after `T001` starts.
- `T013` can run after `T005` through `T012` are implemented.
- `T014`, `T015`, and `T016` can run in parallel.
- `T021` and `T022` can run in parallel.
- `T028` can run while documentation tasks are underway once runtime behavior is stable.
- `T032` and `T033` can run in parallel near the end.

---

## Parallel Example: User Story 1

```bash
# Launch the Srclight adapter test updates together:
Task: "Add Srclight adapter config and routing tests in packages/mcp-adapters/srclight/src/config.test.ts and packages/mcp-adapters/srclight/src/routing.test.ts"
Task: "Update unified routing and router tests for Srclight priority and passthrough namespace in packages/mcp-core/src/routing/table.test.ts and packages/mcp-core/src/registry/router.test.ts"
Task: "Update MCP integration coverage for Srclight-backed unified and passthrough queries in packages/testing/src/integration/mcp-integration.test.ts"
```

---

## Parallel Example: User Story 2

```bash
# Launch runtime validation test work together:
Task: "Add engine integration coverage for Srclight image build, startup, discovery, and bootstrap in packages/testing/src/integration/engines.test.ts and packages/testing/src/integration/runtime-lifecycle.test.ts"
Task: "Add bridge transport and reconnect regression tests for upstream HTTP/SSE behavior in packages/mcp-core/src/transport/bridge.test.ts and packages/runtime/src/discovery/discover.test.ts"
```

---

## Implementation Strategy

### Required Delivery Sequence

1. Complete Phase 1 and Phase 2.
2. Complete User Story 1 and validate Srclight-backed unified and passthrough code-intelligence queries.
3. Complete User Story 2 and validate automatic startup, indexing, and degraded handling.
4. Complete User Story 3 and update runtime-facing docs from observed behavior.
5. Complete Phase 6 cross-cutting cleanup and run the full validation suites.
6. Treat the feature as incomplete until every phase above is finished.

### Delivery Rule

1. No partial-scope stop point is acceptable for this feature.
2. All tasks in this file are required to consider the Srclight replacement complete.
3. User story checkpoints are validation gates, not optional shipping boundaries.

### Parallel Team Strategy

1. One engineer handles runtime/config prerequisites in Phase 2.
2. Once Phase 2 is complete:
   Engineer A: User Story 1 adapter and routing work.
   Engineer B: User Story 2 runtime/bootstrap work.
3. After validation stabilizes, documentation and workflow validation proceed in User Story 3.

---

## Notes

- `[P]` tasks touch different files and do not depend on incomplete work.
- User story labels trace each task back to the prioritized stories in `spec.md`.
- The `codebrain` replacement is not complete until stale runtime branches, tests, and docs are removed or rewritten for Srclight.
- The feature is not complete until all tasks across all phases are finished and validated.
- `docs/features/*` must reflect live runtime behavior, not intended behavior.