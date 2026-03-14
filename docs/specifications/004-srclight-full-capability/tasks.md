# Tasks: Srclight Full Capability Enablement

**Input**: Design documents from `/docs/specifications/004-srclight-full-capability/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are required for this feature due to constitution testing gates and explicit runtime-validation outcomes in spec.md.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no dependency on incomplete tasks)
- **[Story]**: User story label (`[US1]`, `[US2]`, `[US3]`) for story-phase tasks only
- Every task includes concrete file paths

## Phase 1: Setup (Shared Preparation)

**Purpose**: Prepare runtime-image scaffolding and feature task entry points.

- [X] T001 Add CPU runtime image definition for Srclight in `docker/images/srclight/Dockerfile.cpu`
- [X] T002 Update CUDA runtime image for Srclight in `docker/images/srclight/Dockerfile`
- [X] T003 [P] Add Srclight runtime variant contract notes for CPU/CUDA selection in `docs/specifications/004-srclight-full-capability/contracts/global-gpu-policy.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared global GPU policy and resolution plumbing used by all affected runtime paths.

**⚠️ CRITICAL**: User story implementation starts after these prerequisites are complete.

- [X] T004 Add global GPU policy schema (`gpuMode: auto|on|off`) in `packages/config/src/schema/index.ts`
- [X] T005 Add default global GPU policy (`auto`) in `packages/config/src/defaults/index.ts`
- [X] T006 Implement centralized GPU resolver in `packages/runtime/src/services/gpu-policy.ts`
- [X] T007 Wire GPU resolver into runtime orchestration in `packages/runtime/src/services/runtime-lifecycle.ts`
- [X] T008 Add GPU policy contract support to adapter/runtime types in `packages/mcp-adapters/src/types.ts` and `packages/runtime/src/types/index.ts`
- [X] T009 [P] Add config schema regression coverage for global GPU policy in `packages/config/src/schema/config.test.ts`
- [X] T010 [P] Add negative test that legacy `srclight.settings.gpuEnabled` is not mapped to global `gpuMode` in `packages/config/src/schema/config.test.ts`
- [X] T011 [P] Add GPU resolver unit tests in `packages/runtime/src/services/gpu-policy.test.ts`

**Checkpoint**: Global GPU policy and runtime resolution are stable and reusable.

---

## Phase 3: User Story 1 - Complete Srclight Tool Surface Accessible To Agents (Priority: P1) 🎯 MVP

**Goal**: Cover the full Srclight tool surface through unified routing or explicit passthrough-only exposure.

**Independent Test**: Runtime discovery plus MCP calls demonstrate all 29 tools reachable (26 unified, 3 passthrough-only).

### Tests for User Story 1

- [X] T012 [P] [US1] Add unified tool registry/type tests for new tool names in `packages/mcp-core/src/types/index.ts` and `packages/mcp-core/src/registry/router.test.ts`
- [X] T013 [P] [US1] Add Srclight routing and dispatch tests for new mappings in `packages/mcp-adapters/srclight/src/routing.test.ts`
- [X] T014 [P] [US1] Add integration coverage for unified/passthrough reachability in `tests/integration/mcp-integration.test.ts`

### Implementation for User Story 1

- [X] T015 [US1] Add new unified tool names to core type system in `packages/mcp-core/src/types/index.ts`
- [X] T016 [US1] Register new unified tool descriptions and schemas in `packages/mcp-core/src/registry/router.ts`
- [X] T017 [US1] Implement Srclight routing rule additions and corrections in `packages/mcp-adapters/srclight/src/routing.ts`
- [X] T018 [US1] Implement input-driven `inspect_platform_code` dispatch and empty-input handling in `packages/mcp-adapters/srclight/src/routing.ts`
- [X] T019 [US1] Add unified execution branches for `list_workspace_projects`, `find_tests`, `inspect_type_hierarchy`, `inspect_platform_code`, and `refresh_index` in `packages/mcp-adapters/srclight/src/routing.ts`

**Checkpoint**: Full Srclight routing coverage is available through discovery-backed unified/passthrough paths.

---

## Phase 4: User Story 2 - GPU-Accelerated Vector Search Available When Hardware Is Present (Priority: P2)

**Goal**: Enforce global GPU policy with safe auto-detection, explicit `on` failure, and `off` CPU forcing.

**Independent Test**: `gpuMode=auto|on|off` produces expected runtime variant and diagnostics without cross-story dependencies.

### Tests for User Story 2

- [X] T020 [P] [US2] Add compose rendering tests for GPU reservation and dockerfile/runtime-variant selection in `packages/runtime/src/compose/render.test.ts`
- [X] T021 [P] [US2] Add runtime lifecycle readiness-gating verification that bootstrap completion is still required under `gpuMode` variants in `packages/runtime/src/services/runtime-lifecycle.test.ts`
- [X] T022 [P] [US2] Add integration tests for `gpuMode` behavior and diagnostics across host capability scenarios in `tests/integration/engines.test.ts`

### Implementation for User Story 2

- [X] T023 [US2] Implement Srclight runtime variant and dockerfile selection wiring (`cpu|cuda`) in `packages/runtime/src/images/engine-images.ts` and `packages/mcp-adapters/srclight/src/config.ts` (selection logic only)
- [X] T024 [US2] Emit/suppress GPU reservation from resolved policy in `packages/runtime/src/compose/render.ts`
- [X] T025 [US2] Translate resolved global GPU policy into Srclight adapter env in `packages/mcp-adapters/srclight/src/config.ts` (env propagation only, no runtime-variant selection decisions)
- [X] T026 [US2] Propagate resolved GPU policy signals into bootstrap/runtime evidence in `packages/runtime/src/bootstrap/run.ts` and `packages/runtime/src/state/io.ts`

**Checkpoint**: GPU policy behaves deterministically across GPU and non-GPU hosts.

---

## Phase 5: User Story 3 - Ollama Embeddings Reachable By Default Without Manual URL Configuration (Priority: P3)

**Goal**: Make local Ollama embedding setup work by default with deterministic model precedence.

**Independent Test**: Fresh config and runtime render show usable Ollama defaults and embedding activation behavior.

### Tests for User Story 3

- [X] T027 [P] [US3] Add schema/default tests for `defaultEmbedModel` and Ollama URL defaults in `packages/config/src/schema/config.test.ts`
- [X] T028 [P] [US3] Add Srclight config translation tests for effective embedding model precedence in `packages/mcp-adapters/srclight/src/config.test.ts`
- [X] T029 [P] [US3] Add runtime integration coverage for embedding degraded/healthy paths in `tests/integration/runtime-lifecycle.test.ts`

### Implementation for User Story 3

- [X] T030 [US3] Add `defaultEmbedModel` schema field and keep `embedModel` override semantics in `packages/config/src/schema/index.ts`
- [X] T031 [US3] Set default Ollama base URL and default embed model in `packages/config/src/defaults/index.ts`
- [X] T032 [US3] Implement effective embedding model activation (`embedModel ?? defaultEmbedModel`) in `packages/mcp-adapters/srclight/src/config.ts` and `packages/mcp-adapters/srclight/src/bootstrap.ts`
- [X] T033 [US3] Add Srclight host bridge `extra_hosts` mapping in `packages/runtime/src/compose/render.ts`

**Checkpoint**: Embedding configuration is local-first, low-friction, and consistent with runtime truth reporting.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize docs, validate quickstart, and run end-to-end quality checks.

- [X] T034 Update runtime behavior documentation in `docs/features/mcp-server.md`
- [X] T035 [P] Update client-facing behavior notes in `docs/features/mcp-client.md`
- [X] T036 [P] Update Srclight runtime and routing contracts in `docs/specifications/001-local-code-intelligence/contracts/srclight-runtime.md` and `docs/specifications/001-local-code-intelligence/contracts/srclight-routing.md`
- [X] T037 Validate quickstart scenarios and align instructions in `docs/specifications/004-srclight-full-capability/quickstart.md`
- [X] T038 Execute regression workflow tests in `tests/integration/speckit-integration.test.ts` and `tests/workflow/end-to-end.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Starts immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks story work.
- **Phase 3 (US1)**: Starts after Phase 2; establishes MVP routing coverage.
- **Phase 4 (US2)**: Starts after Phase 2; can run in parallel with US1 once shared type updates are merged.
- **Phase 5 (US3)**: Starts after Phase 2; can run in parallel with US1/US2 except shared config files.
- **Phase 6 (Polish)**: Starts after selected stories are complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on US2/US3 behavior; only depends on Foundational phase.
- **US2 (P2)**: Depends on global GPU resolver from Phase 2; independent of US1 route logic.
- **US3 (P3)**: Depends on config/schema baseline from Phase 2; independent of US1/US2 completion.

### Within Each User Story

- Tests are authored before or alongside implementation and must fail prior to functional changes.
- Type/registry definitions precede adapter routing execution changes.
- Runtime policy decisions precede compose emission and diagnostics.
- Config defaults/schema precede translation/bootstrap behavior.

## Parallel Opportunities

- Phase 2: T009, T010, and T011 can run in parallel after T004-T008 scaffold changes.
- US1: T012, T013, T014 are parallel test tasks; T017 and T018 can parallelize after T015-T016.
- US2: T020, T021, T022 are parallel tests; T024 and T025 can parallelize after T023.
- US3: T027, T028, T029 are parallel tests; T031 and T033 can parallelize after T030.
- Polish: T035 and T036 run in parallel with T034.

## Parallel Example: User Story 1

```bash
# Parallel US1 tests
Task T012: packages/mcp-core/src/types/index.ts + packages/mcp-core/src/registry/router.test.ts
Task T013: packages/mcp-adapters/srclight/src/routing.test.ts
Task T014: tests/integration/mcp-integration.test.ts

# Parallel US1 implementation after core type registration
Task T017: packages/mcp-adapters/srclight/src/routing.ts (rule additions/corrections)
Task T018: packages/mcp-adapters/srclight/src/routing.ts (input-driven dispatch + empty-input handling)
```

## Parallel Example: User Story 2

```bash
# Parallel US2 tests
Task T020: packages/runtime/src/compose/render.test.ts
Task T021: packages/runtime/src/services/runtime-lifecycle.test.ts
Task T022: tests/integration/engines.test.ts

# Parallel US2 implementation after runtime variant helper
Task T024: packages/runtime/src/compose/render.ts
Task T025: packages/mcp-adapters/srclight/src/config.ts
```

## Parallel Example: User Story 3

```bash
# Parallel US3 tests
Task T027: packages/config/src/schema/config.test.ts
Task T028: packages/mcp-adapters/srclight/src/config.test.ts
Task T029: tests/integration/runtime-lifecycle.test.ts

# Parallel US3 implementation after schema field addition
Task T031: packages/config/src/defaults/index.ts
Task T033: packages/runtime/src/compose/render.ts
```

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Deliver Phase 3 (US1).
3. Validate 29-tool reachability outcomes and discovery-backed behavior.
4. Demo/deploy MVP routing coverage.

### Incremental Delivery

1. Ship US1 routing coverage.
2. Ship US2 global GPU policy and runtime selection.
3. Ship US3 embedding defaults and host bridge improvements.
4. Finish cross-cutting docs and workflow validation.

### Team Parallelization

1. Team A: Phase 2 global policy resolver and config schema.
2. Team B: US1 routing/type/registry updates.
3. Team C: US2 runtime variant + compose policy emission.
4. Team D: US3 embedding default/model precedence + docs.

## Notes

- Every task follows required checklist format with task ID and file path.
- Story labels are applied only to user story phases.
- Global GPU policy is intentionally centralized so future GPU-capable adapters can reuse the same resolver.
- No legacy fallback mapping for `gpuEnabled` is included in this feature scope.
