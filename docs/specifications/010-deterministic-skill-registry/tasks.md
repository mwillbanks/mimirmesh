# Tasks: Deterministic Skill Registry, Retrieval, Caching, Compression, and Authoring

**Input**: Design documents from `/docs/specifications/010-deterministic-skill-registry/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/skills-mcp.md, quickstart.md

**Tests**: Testing is required by the spec and repository standards. Include package, workflow, and integration coverage for each user story.

**Organization**: Tasks are grouped by user story so each increment can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare package boundaries, dependencies, and command scaffolding for the feature.

- [x] T001 Update dependency declarations and package wiring for skill-registry work in /Volumes/Projects/mimirmesh/packages/skills/package.json, /Volumes/Projects/mimirmesh/packages/mcp-core/package.json, /Volumes/Projects/mimirmesh/packages/runtime/package.json, /Volumes/Projects/mimirmesh/packages/config/package.json, /Volumes/Projects/mimirmesh/packages/installer/package.json, and /Volumes/Projects/mimirmesh/apps/cli/package.json
- [x] T002 Add skill-registry export scaffolding in /Volumes/Projects/mimirmesh/packages/skills/src/index.ts, /Volumes/Projects/mimirmesh/packages/mcp-core/src/index.ts, /Volumes/Projects/mimirmesh/packages/runtime/src/index.ts, and /Volumes/Projects/mimirmesh/packages/config/src/index.ts
- [x] T003 [P] Create CLI command entry scaffolding for inspection and authoring flows in /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/find.tsx, /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/read.tsx, /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/resolve.tsx, /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/refresh.tsx, and /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/create.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared domain, storage, config, and workflow primitives that all user stories depend on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [x] T004 Implement normalized skill domain types and parser interfaces in /Volumes/Projects/mimirmesh/packages/skills/src/types.ts and /Volumes/Projects/mimirmesh/packages/skills/src/parser.ts
- [x] T005 [P] Implement cache-key, compression, and UUIDv7 helpers using Bun built-ins in /Volumes/Projects/mimirmesh/packages/skills/src/cache.ts and /Volumes/Projects/mimirmesh/packages/skills/src/compression.ts
- [x] T006 [P] Implement repository-local skills config schema and defaults in /Volumes/Projects/mimirmesh/packages/config/src/schema/index.ts and /Volumes/Projects/mimirmesh/packages/config/src/defaults/skills.ts
- [x] T007 [P] Implement runtime persistence interfaces and migrations for skill records, caches, compressed blobs, and embeddings in /Volumes/Projects/mimirmesh/packages/runtime/src/services/skill-registry-store.ts and /Volumes/Projects/mimirmesh/packages/runtime/src/state/skills-migrations.ts
- [x] T008 Implement six-tool MCP registration scaffolding with concise published descriptions retained in /Volumes/Projects/mimirmesh/packages/mcp-core/src/registry/skills-tools.ts and /Volumes/Projects/mimirmesh/apps/server/src/startup/start-server.ts
- [x] T009 [P] Implement shared CLI workflow state, progress, and output primitives for skill operations in /Volumes/Projects/mimirmesh/apps/cli/src/workflows/skills.ts and /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/shared.ts
- [x] T010 Implement runtime bootstrap and readiness wiring for skill indexing and provider discovery in /Volumes/Projects/mimirmesh/packages/runtime/src/bootstrap/skills.ts and /Volumes/Projects/mimirmesh/packages/runtime/src/health/skills.ts
- [x] T045 [P] Add readiness or status assertion coverage for skill indexing evidence, health classification, and runtime state artifacts in /Volumes/Projects/mimirmesh/packages/runtime/tests/health/skills-readiness.test.ts, /Volumes/Projects/mimirmesh/apps/cli/tests/workflows/install-runtime.test.ts, and /Volumes/Projects/mimirmesh/tests/integration/install-runtime-validation.test.ts

**Checkpoint**: Shared prerequisites are ready. User story work can now begin.

---

## Phase 3: User Story 1 - Minimal Skill Discovery and Reading (Priority: P1)

**Goal**: Deliver minimal `skills.find` discovery and composable `skills.read` progressive disclosure with strict default payloads.

**Independent Test**: Call `skills.find` and `skills.read` against a repository with multiple installed skills and verify that the default discovery result returns only `name`, `shortDescription`, and `cacheKey`, while targeted reads return only requested content.

### Tests for User Story 1

- [x] T011 [P] [US1] Add unit tests for descriptor projection, deterministic `shortDescription` truncation, deterministic `cacheKey` derivation, and read-plan composition in /Volumes/Projects/mimirmesh/packages/skills/tests/discovery-read.test.ts
- [x] T012 [P] [US1] Add MCP contract tests for `skills.find` and `skills.read` in /Volumes/Projects/mimirmesh/packages/mcp-core/tests/registry/skills-tools.test.ts
- [x] T013 [P] [US1] Add CLI workflow tests for find/read inspection commands in /Volumes/Projects/mimirmesh/tests/integration/skills-workflows.test.ts and /Volumes/Projects/mimirmesh/apps/cli/tests/commands/skills/surface.test.tsx

### Implementation for User Story 1

- [x] T014 [P] [US1] Implement minimal skill descriptor projection with default `name`, deterministic `shortDescription`, and deterministic `cacheKey` fields in /Volumes/Projects/mimirmesh/packages/skills/src/discovery.ts
- [x] T015 [P] [US1] Implement composable read planning and compressed memory projection in /Volumes/Projects/mimirmesh/packages/skills/src/read.ts
- [x] T016 [US1] Wire `skills.find` and `skills.read` handlers through MCP registry and server startup in /Volumes/Projects/mimirmesh/packages/mcp-core/src/registry/skills-tools.ts and /Volumes/Projects/mimirmesh/apps/server/src/startup/start-server.ts
- [x] T017 [US1] Implement CLI `skills find` and `skills read` commands with human-first output in /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/find.tsx and /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/read.tsx
- [x] T018 [US1] Add machine-readable inspection parity for discovery and read flows in /Volumes/Projects/mimirmesh/apps/cli/src/workflows/skills.ts and /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/shared.ts

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Deterministic Resolution and Refresh (Priority: P1)

**Goal**: Deliver deterministic `skills.resolve` and repository-scoped `skills.refresh` with positive/negative cache handling and optional provider fallback.

**Independent Test**: Run repeated resolve and refresh flows with identical inputs and verify stable ordering, repository-scoped cache behavior, refresh invalidation, and deterministic operation when embeddings are disabled.

### Tests for User Story 2

- [x] T019 [P] [US2] Add unit tests for precedence evaluation and refresh invalidation in /Volumes/Projects/mimirmesh/packages/skills/tests/resolve-refresh.test.ts
- [x] T020 [P] [US2] Add runtime store tests for positive cache, negative cache, and embedding state in /Volumes/Projects/mimirmesh/packages/runtime/tests/state/skill-registry-store.test.ts
- [x] T021 [P] [US2] Add CLI and workflow tests for resolve/refresh behavior in /Volumes/Projects/mimirmesh/tests/integration/skills-workflows.test.ts
- [x] T046 [P] [US2] Add tests for resolve behavior with and without `mcpEngineContext` in /Volumes/Projects/mimirmesh/packages/mcp-core/tests/registry/skills-resolve-context.test.ts and /Volumes/Projects/mimirmesh/packages/skills/tests/resolve-refresh.test.ts

### Implementation for User Story 2

- [x] T022 [P] [US2] Implement deterministic resolution planning and minimal result shaping in /Volumes/Projects/mimirmesh/packages/skills/src/resolve.ts
- [x] T023 [P] [US2] Implement refresh orchestration, repository-scoped cache invalidation, and reindex hooks in /Volumes/Projects/mimirmesh/packages/skills/src/refresh.ts and /Volumes/Projects/mimirmesh/packages/runtime/src/services/skill-registry-store.ts
- [x] T024 [P] [US2] Implement embedding provider routing and ordered fallback policy in /Volumes/Projects/mimirmesh/packages/skills/src/embeddings.ts and /Volumes/Projects/mimirmesh/packages/runtime/src/services/skill-registry-store.ts
- [x] T025 [US2] Wire `skills.resolve` and `skills.refresh` handlers through MCP registry and server startup in /Volumes/Projects/mimirmesh/packages/mcp-core/src/registry/skills-tools.ts and /Volumes/Projects/mimirmesh/apps/server/src/startup/start-server.ts
- [x] T026 [US2] Implement CLI `skills resolve` and `skills refresh` commands with progress states and degraded diagnostics in /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/resolve.tsx, /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/refresh.tsx, and /Volumes/Projects/mimirmesh/apps/cli/src/workflows/skills.ts
- [x] T047 [US2] Implement `mcpEngineContext` plumbing for `skills.resolve` through MCP handlers, server registration, and domain resolution logic in /Volumes/Projects/mimirmesh/packages/mcp-core/src/registry/skills-tools.ts, /Volumes/Projects/mimirmesh/apps/server/src/startup/start-server.ts, and /Volumes/Projects/mimirmesh/packages/skills/src/resolve.ts
- [x] T048 [US2] Add machine-readable parity for `skills.resolve` and `skills.refresh` outputs, including resolution order, match reasons, invalidation results, and reindex status, in /Volumes/Projects/mimirmesh/apps/cli/src/workflows/skills.ts, /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/resolve.tsx, and /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/refresh.tsx

**Checkpoint**: User Story 2 is independently functional and testable.

---

## Phase 5: User Story 3 - Guided Skill Authoring and Updating (Priority: P2)

**Goal**: Deliver guided `skills.create` and `skills.update` flows that generate, validate, and preserve full-fidelity skill packages.

**Independent Test**: Create a new skill package and update an existing skill through guided flows, then verify that generated assets, recommendations, validations, and fidelity preservation all work without manual repair.

### Tests for User Story 3

- [x] T027 [P] [US3] Add authoring pipeline unit tests for create/update planning, completeness analysis, and fidelity preservation in /Volumes/Projects/mimirmesh/packages/skills/tests/authoring.test.ts
- [x] T028 [P] [US3] Add CLI workflow tests for guided create/update flows in /Volumes/Projects/mimirmesh/tests/integration/skills-workflows.test.ts and /Volumes/Projects/mimirmesh/apps/cli/tests/commands/skills/shared.test.ts
- [x] T029 [P] [US3] Add MCP contract tests for `skills.create` and `skills.update` in /Volumes/Projects/mimirmesh/packages/mcp-core/tests/registry/skills-tools.test.ts

### Implementation for User Story 3

- [x] T030 [P] [US3] Implement guided create/update planning, completeness analysis, validation orchestration, and fidelity-safe writes in /Volumes/Projects/mimirmesh/packages/skills/src/authoring/create.ts and /Volumes/Projects/mimirmesh/packages/skills/src/authoring/update.ts
- [x] T031 [P] [US3] Implement maintained templates and prompts for skill generation in /Volumes/Projects/mimirmesh/packages/skills/src/authoring/templates.ts and /Volumes/Projects/mimirmesh/packages/skills/src/authoring/prompts.ts
- [x] T032 [US3] Wire `skills.create` and `skills.update` handlers through MCP registry and server startup in /Volumes/Projects/mimirmesh/packages/mcp-core/src/registry/skills-tools.ts and /Volumes/Projects/mimirmesh/apps/server/src/startup/start-server.ts
- [x] T033 [US3] Extend CLI guided authoring flows with interactive prompts, completeness-analysis output, and validation output in /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/create.tsx, /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/update.tsx, and /Volumes/Projects/mimirmesh/apps/cli/src/workflows/skills.ts, with `mimirmesh skills update <skill-name>` reserved for authoring updates

**Checkpoint**: User Story 3 is independently functional and testable.

---

## Phase 6: User Story 4 - Repository Skill Policy and Agent Guidance Bootstrap (Priority: P2)

**Goal**: Deliver repository-local skill policy, managed `AGENTS.md` guidance, bundled MimirMesh-first skill install, and optional local provider provisioning.

**Independent Test**: Configure `.mimirmesh/config.yml`, run install or update flows, and verify that skill policy takes effect, the managed `AGENTS.md` section is created or updated safely, and optional provider provisioning follows preset and environment rules.

### Tests for User Story 4

- [x] T034 [P] [US4] Add config schema and managed `AGENTS.md` patch tests in /Volumes/Projects/mimirmesh/packages/config/tests/schema/skills-config.test.ts and /Volumes/Projects/mimirmesh/packages/skills/tests/agents-section.test.ts
- [x] T035 [P] [US4] Add installer and CLI workflow tests for presets, guidance updates, embeddings strategy selection, and provider defaults in /Volumes/Projects/mimirmesh/packages/installer/tests/install-policy.test.ts, /Volumes/Projects/mimirmesh/apps/cli/tests/commands/install/index.test.tsx, /Volumes/Projects/mimirmesh/apps/cli/tests/workflows/install.test.ts, and /Volumes/Projects/mimirmesh/apps/cli/tests/workflows/install-rerun.test.ts
- [x] T036 [P] [US4] Add runtime compose-generation tests for Dockerfile-backed local llama.cpp base-image selection in /Volumes/Projects/mimirmesh/packages/runtime/tests/compose/skills-provider.test.ts and /Volumes/Projects/mimirmesh/packages/runtime/tests/compose/render.test.ts

### Implementation for User Story 4

- [x] T037 [P] [US4] Implement repository-local skill policy schema, defaults, and writers for cache, read, and provider settings in /Volumes/Projects/mimirmesh/packages/config/src/schema/index.ts, /Volumes/Projects/mimirmesh/packages/config/src/defaults/skills.ts, and /Volumes/Projects/mimirmesh/packages/config/src/writers/skills.ts
- [x] T038 [P] [US4] Implement managed `AGENTS.md` patching and bundled MimirMesh-first skill content in /Volumes/Projects/mimirmesh/packages/skills/src/install.ts and /Volumes/Projects/mimirmesh/packages/skills/mimirmesh-skill-usage-enforcement/SKILL.md
- [x] T039 [P] [US4] Implement installer preset wiring, first-class embeddings strategy selection, and Dockerfile-backed local llama.cpp Compose provider selection in /Volumes/Projects/mimirmesh/packages/installer/src/install-policy.ts and /Volumes/Projects/mimirmesh/packages/runtime/src/compose/skills-provider.ts
- [x] T040 [US4] Integrate install and repository-maintenance update CLI flows with config mutation, `AGENTS.md` guidance, and provider provisioning in /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/install.tsx, /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/update.tsx, and /Volumes/Projects/mimirmesh/apps/cli/src/workflows/skills.ts, with `mimirmesh skills update` without a skill target reserved for maintenance behavior
- [x] T049 [US4] Add machine-readable parity for managed `AGENTS.md` creation, insertion, update, and no-op outcomes in /Volumes/Projects/mimirmesh/apps/cli/src/workflows/skills.ts, /Volumes/Projects/mimirmesh/apps/cli/src/commands/skills/update.tsx, /Volumes/Projects/mimirmesh/apps/cli/tests/commands/skills/shared.test.ts, and /Volumes/Projects/mimirmesh/apps/cli/tests/workflows/install.test.ts

**Checkpoint**: User Story 4 is independently functional and testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finish documentation, end-to-end validation, and repository-wide enforcement.

- [x] T041 [P] Update /Volumes/Projects/mimirmesh/docs/features/cli-command-surface.md with observed operator-visible states, prompts, progress indicators, disclosure modes, machine-readable inspection behavior for `skills.find`, `skills.read`, `skills.resolve`, and `skills.refresh`, plus observed guided `skills.create` and `skills.update` authoring prompts, validation outcomes, fidelity-preservation behavior, and managed `AGENTS.md` guidance outcomes surfaced through CLI workflows
- [x] T050 [P] Update /Volumes/Projects/mimirmesh/docs/features/mcp-server.md with observed `skills.find`, `skills.read`, `skills.resolve`, `skills.refresh`, `skills.create`, and `skills.update` contract behavior, runtime readiness evidence, degraded diagnostics, and MCP engine-context handling
- [x] T051 [P] Update /Volumes/Projects/mimirmesh/docs/runbooks/first-init.md with configuration prerequisites, bootstrap steps, runtime readiness checks, managed `AGENTS.md` outcomes, and provider-provisioning behavior
- [x] T052 [P] Add threshold-validation coverage for default discovery payload reduction, one-discovery-plus-one-read decision efficiency, and targeted-read isolation in /Volumes/Projects/mimirmesh/tests/integration/skills-discovery-thresholds.test.ts
- [x] T053 [P] Add threshold-validation coverage for refresh invalidation latency, authoring success rate, and embeddings-off execution in /Volumes/Projects/mimirmesh/tests/integration/skills-quality-thresholds.test.ts
- [x] T042 Run quickstart-backed end-to-end workflow validation and fill any missing coverage in /Volumes/Projects/mimirmesh/tests/integration/skills-end-to-end.test.ts and /Volumes/Projects/mimirmesh/docs/specifications/010-deterministic-skill-registry/quickstart.md
- [x] T043 [P] Add final package-local regression coverage for skills, runtime, config, and MCP changes in /Volumes/Projects/mimirmesh/packages/skills/tests/, /Volumes/Projects/mimirmesh/packages/runtime/tests/, /Volumes/Projects/mimirmesh/packages/config/tests/, and /Volumes/Projects/mimirmesh/packages/mcp-core/tests/
- [x] T044 Run repository validation and final Biome remediation through /Volumes/Projects/mimirmesh/package.json and /Volumes/Projects/mimirmesh/biome.json

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies.
- Foundational (Phase 2): Depends on Setup and blocks all user stories.
- User Story 1 (Phase 3): Depends on Foundational.
- User Story 2 (Phase 4): Depends on Foundational and reuses the shared discovery and storage primitives from Phases 1-2.
- User Story 3 (Phase 5): Depends on Foundational and shared CLI or MCP scaffolding from earlier phases.
- User Story 4 (Phase 6): Depends on Foundational and shared config or installer scaffolding from earlier phases.
- Polish (Phase 7): Depends on the desired user stories being complete.

### User Story Dependencies

- US1 is the MVP and the recommended first delivery slice.
- US2 should follow US1 in the recommended execution order because resolve and refresh reuse discovery descriptors, read hints, and cache infrastructure.
- US3 can begin after Foundational, but the recommended order is after US1-US2 so authoring can reuse the final read or resolve contracts.
- US4 can begin after Foundational, but the recommended order is after US1-US2 so policy and managed guidance align with the final inspection and resolution flows.

### Recommended Completion Order

- US1 -> US2 -> US3 -> US4

### Within Each User Story

- Tests must be written before the corresponding implementation tasks and should fail before implementation begins.
- Domain logic should land before MCP or CLI wiring.
- MCP and server registration should land before CLI inspection or maintenance flows.
- Story-specific validation should complete before moving to the next recommended story.

### Parallel Opportunities

- T003 can run in parallel with T001-T002.
- T005-T007 and T009 can run in parallel after T004 starts the shared type surface.
- T045 can run in parallel with T010 once the runtime readiness surfaces exist.
- US1 test tasks T011-T013 can run in parallel.
- US1 implementation tasks T014-T015 can run in parallel.
- US2 test tasks T019-T021 can run in parallel.
- US2 implementation tasks T022-T024 can run in parallel.
- T046 can run in parallel with T019-T021.
- T047 and T048 can proceed after T022-T026 establish core resolve or refresh handlers.
- US3 test tasks T027-T029 can run in parallel.
- US3 implementation tasks T030-T031 can run in parallel.
- US4 test tasks T034-T036 can run in parallel.
- US4 implementation tasks T037-T039 can run in parallel.
- T049 can proceed after T040.
- Polish tasks T041, T043, T050, T051, T052, and T053 can run in parallel.

---

## Parallel Example: User Story 1

```bash
Task: "Add unit tests for descriptor projection and read-plan composition in packages/skills/tests/discovery-read.test.ts"
Task: "Add MCP contract tests for skills.find and skills.read in packages/mcp-core/tests/registry/skills-tools.test.ts"
Task: "Add CLI workflow tests for find/read inspection commands in tests/integration/skills-workflows.test.ts and apps/cli/tests/commands/skills/surface.test.tsx"

Task: "Implement minimal skill descriptor projection with default name, shortDescription, and cacheKey fields in packages/skills/src/discovery.ts"
Task: "Implement composable read planning and compressed memory projection in packages/skills/src/read.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Add unit tests for precedence evaluation and refresh invalidation in packages/skills/tests/resolve-refresh.test.ts"
Task: "Add runtime store tests for positive cache, negative cache, and embedding state in packages/runtime/tests/state/skill-registry-store.test.ts"
Task: "Add CLI and workflow tests for resolve/refresh behavior in tests/integration/skills-workflows.test.ts"

Task: "Implement deterministic resolution planning and minimal result shaping in packages/skills/src/resolve.ts"
Task: "Implement refresh orchestration, repository-scoped cache invalidation, and reindex hooks in packages/skills/src/refresh.ts and packages/runtime/src/services/skill-registry-store.ts"
Task: "Implement embedding provider routing and ordered fallback policy in packages/skills/src/embeddings.ts and packages/runtime/src/services/skill-registry-store.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Add authoring pipeline unit tests for create/update planning and fidelity preservation in packages/skills/tests/authoring.test.ts"
Task: "Add CLI workflow tests for guided create/update flows in tests/integration/skills-workflows.test.ts and apps/cli/tests/commands/skills/shared.test.ts"
Task: "Add MCP contract tests for skills.create and skills.update in packages/mcp-core/tests/registry/skills-tools.test.ts"

Task: "Implement guided create/update planning, validation orchestration, and fidelity-safe writes in packages/skills/src/authoring/create.ts and packages/skills/src/authoring/update.ts"
Task: "Implement maintained templates and prompts for skill generation in packages/skills/src/authoring/templates.ts and packages/skills/src/authoring/prompts.ts"
```

## Parallel Example: User Story 4

```bash
Task: "Add config schema and managed AGENTS.md patch tests in packages/config/tests/schema/skills-config.test.ts and packages/skills/tests/agents-section.test.ts"
Task: "Add installer and CLI workflow tests for presets, guidance updates, embeddings strategy selection, and provider defaults in packages/installer/tests/install-policy.test.ts, apps/cli/tests/commands/install/index.test.tsx, apps/cli/tests/workflows/install.test.ts, and apps/cli/tests/workflows/install-rerun.test.ts"
Task: "Add runtime compose-generation tests for Dockerfile-backed local llama.cpp base-image selection in packages/runtime/tests/compose/skills-provider.test.ts and packages/runtime/tests/compose/render.test.ts"

Task: "Implement repository-local skill policy schema, defaults, and writers for cache, read, and provider settings in packages/config/src/schema/index.ts, packages/config/src/defaults/skills.ts, and packages/config/src/writers/skills.ts"
Task: "Implement managed AGENTS.md patching and bundled MimirMesh-first skill content in packages/skills/src/install.ts and packages/skills/mimirmesh-skill-usage-enforcement/SKILL.md"
Task: "Implement installer preset wiring and local llama.cpp Compose provider selection in packages/installer/src/install-policy.ts and packages/runtime/src/compose/skills-provider.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate User Story 1 independently before expanding scope.

### Incremental Delivery

1. Setup plus Foundational complete the shared substrate.
2. Deliver US1 for minimal discovery and read.
3. Deliver US2 for deterministic resolution and refresh.
4. Deliver US3 for guided authoring and update.
5. Deliver US4 for repository policy, managed guidance, and provider provisioning.
6. Finish with documentation, quickstart validation, and repository-wide enforcement.

### Parallel Team Strategy

1. One engineer handles storage and config work in Phase 2 while another prepares CLI and MCP scaffolding.
2. After Phase 2, US1 and US4 can proceed in parallel if teams coordinate on shared workflow files.
3. US2 and US3 can then proceed once the shared registry contracts are stable.

---

## Notes

- `[P]` marks tasks that can proceed in parallel because they touch separate files or independent test surfaces.
- `[US1]` through `[US4]` map each task back to a specific user story for traceability.
- Every user story includes explicit tests because the spec, AGENTS guidance, and repository standards require them.
- The recommended MVP scope is User Story 1 only.
