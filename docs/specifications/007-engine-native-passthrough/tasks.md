# Tasks: Engine-Native Passthrough Namespacing

**Input**: Design documents from `/docs/specifications/007-engine-native-passthrough/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/passthrough-publication.md, quickstart.md

**Tests**: Testing is required for this feature because the public MCP contract changes across server, client, CLI, readiness/status reporting, and workflow surfaces.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the shared naming helpers and canonical engine publication model used by every story.

- [X] T001 [P] Create shared passthrough name mapping helpers in `apps/server/src/middleware/tool-name.ts`, `apps/client/src/orchestration/tools.ts`, and `packages/mcp-core/src/registry/router.ts`
- [X] T002 [P] Align passthrough-capable engine publication metadata around canonical engine IDs in `packages/mcp-adapters/src/types.ts`, `packages/mcp-adapters/srclight/src/index.ts`, `packages/mcp-adapters/document-mcp/src/index.ts`, and `packages/mcp-adapters/mcp-adr-analysis-server/src/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Preserve internal discovery truth, add publication metadata, and prove bootstrap/readiness behavior before user-story work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Preserve internal passthrough route state while exposing engine publication metadata in `packages/runtime/src/discovery/discover.ts`, `packages/runtime/src/types/index.ts`, and `packages/mcp-core/src/types/index.ts`
- [X] T004 Add engine bootstrap verification for passthrough-capable engines in `docs/specifications/007-engine-native-passthrough/quickstart.md` and `tests/workflow/end-to-end.test.ts`
- [X] T005 Add readiness and degraded-status assertions for discovery-gated passthrough publication in `apps/cli/src/workflows/mcp.ts`, `tests/integration/mcp-integration.test.ts`, and `tests/workflow/end-to-end.test.ts`
- [X] T006 Add shared naming regression coverage in `apps/server/tests/middleware/tool-name.test.ts`, `packages/mcp-core/tests/registry/router.test.ts`, and `packages/runtime/tests/discovery/discover.test.ts`

**Checkpoint**: Shared naming primitives, routing/discovery publication metadata, and readiness/bootstrap evidence are in place.

---

## Phase 3: User Story 1 - Engine-Origin Passthrough Names Are Clear (Priority: P1) 🎯 MVP

**Goal**: Publish passthrough tools as `<engine>_<tool>` for live-discovered canonical engines while keeping unified tool names unchanged and preserving engine attribution in metadata and diagnostics.

**Independent Test**: Start a healthy runtime, verify bootstrap and readiness evidence, run `mimirmesh-client list-tools`, confirm passthrough tools from more than one eligible engine use engine-native names, then invoke one published passthrough tool and one unified tool successfully while verifying published metadata and diagnostics still attribute the tool to the correct engine.

### Tests for User Story 1

- [X] T007 [P] [US1] Add MCP server publication coverage for engine-native passthrough names in `apps/server/tests/middleware/tool-name.test.ts` and `apps/server/tests/startup/start-server.test.ts`
- [X] T008 [P] [US1] Update transport-surface integration coverage for published passthrough names in `tests/integration/mcp-integration.test.ts` and `tests/workflow/end-to-end.test.ts`
- [X] T009 [P] [US1] Add reusable multi-engine naming assertions for canonical passthrough engines in `packages/runtime/tests/discovery/discover.test.ts` and `packages/mcp-core/tests/routing/table.test.ts`
- [X] T010 [P] [US1] Add regression coverage proving arbitrary proxied external MCP servers without canonical engine IDs stay outside the naming contract in `packages/runtime/tests/discovery/discover.test.ts` and `packages/mcp-core/tests/registry/router.regressions.test.ts`
- [X] T011 [P] [US1] Add provenance and engine-attribution assertions for published passthrough tools and retired-alias diagnostics in `tests/integration/mcp-integration.test.ts`, `tests/workflow/end-to-end.test.ts`, and `packages/mcp-core/tests/registry/router.test.ts`

### Implementation for User Story 1

- [X] T012 [US1] Publish engine-native passthrough names during MCP server registration in `apps/server/src/startup/start-server.ts`
- [X] T013 [US1] Accept and invoke engine-native passthrough names through the client transport layer in `apps/client/src/orchestration/tools.ts` and `apps/client/src/index.ts`
- [X] T014 [US1] Keep unified names unchanged while exposing passthrough publication only for eligible canonical engines and preserving engine-attribution metadata in `packages/mcp-core/src/registry/router.ts` and `packages/runtime/src/discovery/discover.ts`

**Checkpoint**: Live-discovered passthrough tools are published and invokable as `<engine>_<tool>` without changing unified tool names, pulling non-canonical external servers into the contract, or losing engine-attribution metadata.

---

## Phase 4: User Story 2 - Legacy Passthrough Aliases Fail Clearly (Priority: P2)

**Goal**: Retire `mimirmesh`-prefixed passthrough aliases from the published surface while returning explicit replacement guidance on invocation.

**Independent Test**: Invoke a retired `mimirmesh`-prefixed passthrough alias after the rename lands and confirm the response fails with the correct `<engine>_<tool>` replacement name.

### Tests for User Story 2

- [X] T015 [P] [US2] Add guided-failure coverage for retired passthrough aliases in `packages/mcp-core/tests/registry/router.test.ts`, `tests/integration/mcp-integration.test.ts`, and `tests/workflow/end-to-end.test.ts`

### Implementation for User Story 2

- [X] T016 [US2] Implement retired alias parsing and replacement-name guidance in `apps/server/src/middleware/tool-name.ts` and `packages/mcp-core/src/registry/router.ts`
- [X] T017 [US2] Register non-published legacy passthrough aliases with explicit replacement errors in `apps/server/src/startup/start-server.ts`
- [X] T018 [US2] Propagate replacement-oriented passthrough failures through client and CLI invocation flows in `apps/client/src/orchestration/tools.ts`, `apps/cli/src/lib/context.ts`, and `apps/cli/src/workflows/mcp.ts`

**Checkpoint**: Legacy passthrough aliases are no longer published and now fail with deterministic rename guidance.

---

## Phase 5: User Story 3 - Documentation And Inspection Surfaces Match The New Contract (Priority: P3)

**Goal**: Make CLI inspection, machine-readable output, feature docs, and skill guidance show the same engine-native passthrough names and readiness truth that the runtime publishes.

**Independent Test**: Compare TUI and direct CLI `mcp list-tools` flows, supported machine-readable output, feature docs, and skill examples against a healthy runtime and confirm they all use the same published `<engine>_<tool>` names and readiness semantics.

### Tests for User Story 3

- [X] T019 [P] [US3] Add CLI inspection assertions for engine-native passthrough names in `apps/cli/src/workflows/mcp.ts` and `tests/integration/mcp-integration.test.ts`
- [X] T020 [P] [US3] Add CLI structured-output, prompt-safety, progress/readiness visibility, and TUI/direct-command parity assertions for passthrough naming in `apps/cli/src/commands/mcp/list-tools.tsx`, `apps/cli/src/workflows/mcp.ts`, `tests/integration/mcp-integration.test.ts`, and `tests/workflow/end-to-end.test.ts`

### Implementation for User Story 3

- [X] T021 [US3] Update local CLI tool inspection surfaces to display engine-native passthrough names, shared readiness state, and supported machine-readable output in `apps/cli/src/lib/context.ts`, `apps/cli/src/commands/mcp/list-tools.tsx`, and `apps/cli/src/workflows/mcp.ts`
- [X] T022 [P] [US3] Update feature documentation for the published passthrough contract and readiness behavior in `docs/features/mcp-server.md` and `docs/features/mcp-client.md`
- [X] T023 [P] [US3] Update operational skill guidance to use engine-native passthrough names and retired-alias guidance in `packages/skills/mimirmesh-code-investigation/SKILL.md` and `packages/skills/mimirmesh-integration-analysis/SKILL.md`

**Checkpoint**: Inspection surfaces and operator guidance match the live engine-native passthrough contract.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the full contract across runtime, CLI, documentation, and regression suites.

- [X] T024 [P] Validate the quickstart scenarios, including bootstrap verification and readiness/status checks, against a healthy runtime in `docs/specifications/007-engine-native-passthrough/quickstart.md` and `tests/workflow/end-to-end.test.ts`
- [X] T025 Run package-local and end-to-end regression suites for changed surfaces in `apps/server/tests/middleware/tool-name.test.ts`, `packages/mcp-core/tests/registry/router.test.ts`, `packages/runtime/tests/discovery/discover.test.ts`, `tests/integration/mcp-integration.test.ts`, and `tests/workflow/end-to-end.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies; start immediately.
- **Phase 2: Foundational**: Depends on Phase 1; blocks all user stories until naming, bootstrap, and readiness assertions are in place.
- **Phase 3: User Story 1**: Depends on Phase 2; establishes the published engine-native passthrough surface and canonical-engine eligibility rules.
- **Phase 4: User Story 2**: Depends on Phase 3; legacy alias guidance relies on the new published names.
- **Phase 5: User Story 3**: Depends on Phase 3; CLI inspection and documentation must reflect the actual published names and readiness truth.
- **Phase 6: Polish**: Depends on completion of the desired user stories.

### User Story Dependencies

- **US1 (P1)**: No dependency on other user stories after Foundational.
- **US2 (P2)**: Depends on US1 because alias guidance must reference the published engine-native names.
- **US3 (P3)**: Depends on US1 because CLI inspection, docs, and skills must reflect the implemented published names.

### Within Each User Story

- Test updates land before or alongside the implementation they validate.
- Publication and invocation changes must be in place before docs and skills are refreshed.
- Legacy alias handling must not reintroduce dual-publication in the tool inventory.
- CLI presentation changes must preserve shared-state parity and prompt-safe non-interactive behavior.

### Parallel Opportunities

- T001 and T002 can run in parallel at setup.
- T007, T008, T009, T010, and T011 can run in parallel once Foundational work is complete.
- T022 and T023 can run in parallel after CLI inspection output is finalized.
- T024 and T025 can run in parallel once implementation is complete.

---

## Parallel Example: User Story 1

```bash
Task: "Add MCP server publication coverage for engine-native passthrough names in apps/server/tests/middleware/tool-name.test.ts and apps/server/tests/startup/start-server.test.ts"
Task: "Update transport-surface integration coverage for published passthrough names in tests/integration/mcp-integration.test.ts and tests/workflow/end-to-end.test.ts"
Task: "Add reusable multi-engine naming assertions for canonical passthrough engines in packages/runtime/tests/discovery/discover.test.ts and packages/mcp-core/tests/routing/table.test.ts"
Task: "Add regression coverage proving arbitrary proxied external MCP servers without canonical engine IDs stay outside the naming contract in packages/runtime/tests/discovery/discover.test.ts and packages/mcp-core/tests/registry/router.regressions.test.ts"
Task: "Add provenance and engine-attribution assertions for published passthrough tools and retired-alias diagnostics in tests/integration/mcp-integration.test.ts, tests/workflow/end-to-end.test.ts, and packages/mcp-core/tests/registry/router.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Update feature documentation for the published passthrough contract and readiness behavior in docs/features/mcp-server.md and docs/features/mcp-client.md"
Task: "Update operational skill guidance to use engine-native passthrough names and retired-alias guidance in packages/skills/mimirmesh-code-investigation/SKILL.md and packages/skills/mimirmesh-integration-analysis/SKILL.md"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 to publish and invoke engine-native passthrough names.
3. Validate bootstrap/readiness evidence, `mimirmesh-client list-tools`, multi-engine publication behavior, a published passthrough call, and a unified tool call before proceeding.

### Incremental Delivery

1. Deliver US1 to establish the new public naming contract.
2. Deliver US2 to close the migration path with explicit rename guidance.
3. Deliver US3 to align CLI inspection, machine-readable output, docs, and skill guidance with the shipped behavior.
4. Finish with quickstart and regression validation.

### Parallel Team Strategy

1. One engineer completes Phase 1 and Phase 2 shared naming groundwork.
2. After US1 starts, another engineer can prepare US2 guided-failure coverage while a third readies US3 CLI parity, doc, and skill updates.
3. Merge US2 and US3 only after US1 external naming behavior is stable.

## Notes

- [P] tasks are safe to parallelize because they touch separate files or separate validation surfaces.
- Internal routing-table identifiers may remain unchanged if the external `<engine>_<tool>` contract and legacy alias guidance behave correctly.
- CLI-facing validation must cover TUI/direct parity, supported machine-readable output, readiness visibility, and prompt-safe non-interactive behavior.
- Historical specification documents are not part of this feature's required documentation updates unless implementation reveals they are active operator guidance.
