# Feature Specification: Local-First Code Intelligence Engine

**Feature Branch**: `001-local-code-intelligence`  
**Created**: 2026-03-13  
**Status**: Draft  
**Input**: User description: "Replace the current code-intelligence engine used for semantic and structural code search with a local-first engine that provides stronger repository intelligence without requiring a third-party hosted LLM. The new engine must support deep code indexing, fast codebase querying for AI agents, and fit into the existing MimirMesh unified MCP model so agents can use it through both passthrough and unified tools. The replacement must preserve or improve the current user outcomes for code understanding, symbol lookup, search, relationship navigation, and repository orientation while reducing external dependency requirements and improving local privacy. The feature must also ensure that the new engine is installed, configured, indexed, and validated automatically during the MimirMesh runtime lifecycle, and that its real runtime behavior is documented accurately for both the MCP server and MCP client features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reliable Repository Intelligence For Agents (Priority: P1)

As an AI agent or developer using MimirMesh, I need the replacement engine to return accurate repository search, symbol, and relationship results through the existing MCP surfaces so I can understand an unfamiliar codebase without depending on a hosted LLM service.

**Why this priority**: The primary product value is repository intelligence. If the new engine cannot preserve or improve everyday code understanding outcomes through the existing unified and passthrough paths, the replacement fails regardless of operational improvements.

**Independent Test**: Can be fully tested by indexing a representative repository, calling the MCP server and client for search, symbol lookup, and relationship navigation tasks, and confirming the returned results are relevant, structured, and usable without any hosted AI dependency.

**Acceptance Scenarios**:

1. **Given** the project runtime is healthy and the repository has been indexed, **When** an agent requests code search through a unified MimirMesh tool, **Then** the request returns relevant source matches from the current repository using the replacement engine.
2. **Given** the replacement engine is healthy, **When** an agent requests a passthrough tool for symbol lookup or code relationships, **Then** MimirMesh exposes the live-discovered capability and returns engine-backed results without a synthetic substitute.
3. **Given** a developer is orienting to a repository, **When** they use the server or client to find symbols, references, related files, or architectural neighbors, **Then** the new engine preserves or improves the usefulness of those outcomes compared with the current production experience.

---

### User Story 2 - Automatic Runtime Provisioning And Readiness (Priority: P2)

As an operator starting MimirMesh for a repository, I need the replacement engine to be installed, configured, indexed, and validated automatically during runtime startup so I do not have to perform manual setup or guess whether code intelligence is truly ready.

**Why this priority**: A stronger engine is not useful if runtime lifecycle management becomes manual, brittle, or misleading. Readiness must reflect real indexing and live capability discovery.

**Independent Test**: Can be fully tested by starting the runtime from a clean project state and verifying that installation, configuration, indexing, readiness checks, and degraded-state reporting happen automatically and truthfully.

**Acceptance Scenarios**:

1. **Given** a repository that has not yet been prepared for the replacement engine, **When** the operator starts the MimirMesh runtime, **Then** the engine is provisioned with the required local configuration and begins required indexing without manual intervention.
2. **Given** the engine requires indexing before serving useful queries, **When** runtime readiness is reported healthy, **Then** the required indexing and validation steps have already completed successfully.
3. **Given** the engine cannot start or validate successfully, **When** the operator checks runtime status, **Then** MimirMesh reports the proven cause, the affected code-intelligence capabilities, and the corrective action instead of reporting a false healthy state.

---

### User Story 3 - Accurate Client And Server Runtime Documentation (Priority: P3)

As a developer or operator reading MimirMesh documentation, I need the MCP server and MCP client feature documents to describe the replacement engine's observed runtime behavior accurately so I can trust the documented prerequisites, tool surface, indexing flow, and degraded outcomes.

**Why this priority**: This repository already treats feature documentation as runtime truth. The engine replacement changes a visible product surface and operational model, so inaccurate docs would mislead users and future maintainers.

**Independent Test**: Can be fully tested by validating the updated server and client documentation against live runtime output, discovered tool inventories, and observed bootstrap behavior for the replacement engine.

**Acceptance Scenarios**:

1. **Given** the replacement engine is enabled in a live runtime, **When** the MCP server and client behaviors are validated, **Then** the documentation describes the observed tool exposure, readiness model, prerequisites, and failure modes without stale references to the old engine.
2. **Given** the replacement engine has configuration-dependent limitations, **When** those limits are observed during validation, **Then** the documentation records the real conditions and user-visible impact rather than speculative assumptions.

### Edge Cases

- What happens when runtime startup succeeds but repository indexing is incomplete or interrupted before code-intelligence validation finishes?
- How does the system behave when the replacement engine is healthy enough for basic text search but cannot yet provide symbol or relationship capabilities?
- What happens when the repository is large enough that initial indexing takes materially longer than the rest of runtime startup?
- How does MimirMesh report behavior when the replacement engine is disabled by configuration, blocked by a missing local prerequisite, or incompatible with the current repository layout?
- What happens when a previously indexed repository changes enough that the engine must refresh stale intelligence before query results can be trusted?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: MimirMesh MUST replace the current primary code-intelligence engine for repository search and structural understanding with a local-first engine that does not require a third-party hosted LLM for core code-intelligence workflows.
- **FR-002**: The replacement engine MUST support repository indexing deep enough to power code search, symbol lookup, relationship navigation, and repository orientation outcomes that are at least as useful as the current production experience.
- **FR-003**: MimirMesh MUST expose the replacement engine through the existing unified MCP tools wherever code-intelligence behavior is expected by users.
- **FR-004**: MimirMesh MUST expose the replacement engine's live passthrough capabilities through discovery-backed registration rather than a hard-coded tool inventory.
- **FR-005**: Unified routing for code-intelligence requests MUST resolve to the replacement engine when that engine is healthy and advertises the required live capability.
- **FR-006**: The runtime lifecycle MUST automatically install or materialize the replacement engine, apply the required local configuration, and prepare its repository-scoped working state during normal project startup.
- **FR-007**: The runtime lifecycle MUST automatically perform any required initial indexing or refresh step for the active repository before the code-intelligence surface is reported ready.
- **FR-008**: MimirMesh MUST persist repository-scoped engine state, readiness evidence, and indexing status so operators can inspect whether the replacement engine is prepared for the current repository.
- **FR-009**: Runtime status and health reporting MUST distinguish between healthy, indexing, degraded, disabled, and configuration-blocked states for the replacement engine.
- **FR-010**: When the replacement engine is degraded or unavailable, MimirMesh MUST report the proven cause, affected user-facing capabilities, and corrective guidance based on live runtime checks.
- **FR-011**: The replacement MUST reduce external dependency requirements for repository intelligence compared with the current engine arrangement while preserving local privacy expectations for source code analysis.
- **FR-012**: The MCP server and MCP client documentation MUST be updated to describe the replacement engine's observed runtime behavior, prerequisites, bootstrap flow, discovered tool surface, and degraded modes.
- **FR-013**: Validation for this feature MUST confirm the replacement engine can serve representative repository-understanding tasks through both the server and client surfaces using a live runtime.

### Runtime Truth and Validation Requirements *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RTV-001**: Engine-owned capabilities MUST be discovered from live runtime endpoints and exercised successfully in acceptance scenarios.
- **RTV-002**: The system MUST NOT rely on hard-coded engine tool inventories to represent runtime availability.
- **RTV-003**: Required bootstrap/indexing steps MUST run automatically and MUST be verified before readiness is reported healthy.
- **RTV-004**: Degraded mode MUST report proven root cause, affected capabilities, and corrective actions based on live checks.
- **RTV-005**: Configuration-dependent limitations MUST be classified only after execution-based validation against the active runtime.
- **RTV-006**: Local/private execution MUST be preferred when a capable local option exists; hosted fallback usage MUST be explicit.
- **RTV-007**: Feature documentation under `docs/features/` MUST be updated with observed behavior, prerequisites, bootstrap flow, and degraded outcomes.

### Key Entities *(include if feature involves data)*

- **Code Intelligence Engine Profile**: The repository-scoped record of the active code-intelligence engine, its configured mode, readiness state, discovered capabilities, and validation evidence.
- **Repository Index State**: The current indexing status for a repository, including whether the repository has been prepared, refreshed, or blocked and what user-facing capabilities are available.
- **Capability Catalog**: The live-discovered list of passthrough and unified code-intelligence capabilities that MimirMesh can expose for the replacement engine.
- **Runtime Validation Record**: The evidence captured from startup and verification flows showing whether installation, indexing, discovery, and representative queries succeeded for the active repository.

## Assumptions

- The replacement remains within the existing project-scoped runtime model and does not introduce a separate out-of-band setup workflow for users.
- Existing unified code-intelligence entry points remain the primary user-facing contract, even if the underlying engine capabilities or names change.
- Repository intelligence is evaluated on real project repositories already supported by MimirMesh rather than on synthetic sample data alone.
- Local execution and privacy improvements refer to keeping core code-intelligence processing within the user's controlled runtime environment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In validation runs against a supported repository, operators can reach a truthful healthy code-intelligence state through the standard runtime startup flow without any manual engine setup steps.
- **SC-002**: After indexing completes, at least 95% of representative repository-understanding queries used for acceptance validation return usable results within 10 seconds through the MCP surfaces.
- **SC-003**: Acceptance validation demonstrates successful completion of all primary code-intelligence tasks in scope: code search, symbol lookup, relationship navigation, and repository orientation.
- **SC-004**: The validated runtime for the replacement engine performs all primary code-intelligence workflows without requiring any third-party hosted LLM service.
- **SC-005**: Updated MCP server and MCP client feature documents contain no stale references to the retired engine for the supported code-intelligence workflows.

### Runtime Validation Outcomes *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RVO-001**: Tool discovery reports only live-discovered engine capabilities and zero synthetic engine tools.
- **RVO-002**: Runtime readiness transitions to healthy only after required bootstrap/index jobs complete.
- **RVO-003**: Degraded engine states include explicit, reproducible diagnostics validated in test or workflow output.
- **RVO-004**: Documentation updates under `docs/features/` match observed command/runtime output used during validation.