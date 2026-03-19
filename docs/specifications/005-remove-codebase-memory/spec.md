# Feature Specification: Remove Codebase-Memory MCP Engine

**Feature Branch**: `005-remove-codebase-memory`  
**Created**: 2026-03-18  
**Status**: Ready for Planning  
**Input**: User description: "Remove codebase-memory mcp as it duplicates a subset of Srclight capabilities and is no longer necessary."

## Clarifications

### Session 2026-03-18

- Q: How should legacy project configs containing codebase-memory keys behave after retirement? → A: Auto-migrate legacy codebase-memory config to Srclight during load, then continue.
- Q: How should migration persistence be handled for legacy config updates? → A: Perform one-time migration with config file write-back, then continue normal load.
- Q: Should migration create an automatic backup before write-back? → A: No automatic backup; fail with remediation if write-back fails.
- Q: If both legacy and existing Srclight keys exist, which values take precedence? → A: Existing Srclight values win; migrated legacy values only fill missing Srclight fields.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Runtime Uses Srclight As Single Code-Intelligence Engine (Priority: P1)

As an operator running MimirMesh, I need runtime startup, discovery, and routing to use Srclight as the only code-intelligence engine so there is no redundant codebase-memory service to build, run, or diagnose.

**Why this priority**: Removing duplicate runtime surface is the core user value and directly reduces runtime complexity, startup overhead, and conflicting diagnostics.

**Independent Test**: Initialize and start a project runtime, then verify no codebase-memory service is rendered or started while Srclight discovery and unified routing still function.

**Acceptance Scenarios**:

1. **Given** a newly initialized project, **When** runtime compose is rendered, **Then** no `mm-codebase-memory` service is present and Srclight remains configured.
2. **Given** runtime is started, **When** tool discovery is executed, **Then** no codebase-memory adapter tools are discovered or routed.
3. **Given** unified code-intelligence calls are issued, **When** Srclight is healthy, **Then** calls resolve without codebase-memory fallback logic.

---

### User Story 2 - Config And Adapter Model Excludes Retired Engine (Priority: P2)

As a maintainer, I need configuration schema, defaults, and adapter registration to exclude the codebase-memory engine so project configuration and adapter lists reflect the real supported engine model.

**Why this priority**: Schema and adapter drift causes broken initialization, stale config validation, and misleading runtime expectations.

**Independent Test**: Load generated default config and adapter registry, then verify the retired engine is absent from engine enums, defaults, and adapter lists.

**Acceptance Scenarios**:

1. **Given** config schema validation, **When** a config includes only supported engines, **Then** validation succeeds without codebase-memory keys.
2. **Given** default config generation, **When** defaults are created, **Then** no codebase-memory engine block is included.
3. **Given** adapter registration, **When** adapters are enumerated, **Then** codebase-memory adapter is not registered.
4. **Given** a legacy project config that contains codebase-memory engine keys, **When** config is loaded, **Then** the system migrates those keys to Srclight-compatible configuration, persists the migrated config once, and continues.
5. **Given** a config containing both legacy codebase-memory keys and explicit Srclight keys, **When** migration runs, **Then** existing Srclight values remain unchanged and migrated values fill only missing Srclight fields.

---

### User Story 3 - Documentation And Tests Reflect Engine Retirement (Priority: P3)

As a contributor, I need feature documentation and tests to reflect codebase-memory retirement so project behavior, expectations, and regression coverage remain accurate.

**Why this priority**: Stale docs and tests create false operational guidance and can mask regressions in runtime truth reporting.

**Independent Test**: Run targeted config, runtime, and integration tests and review feature docs to confirm no active references to codebase-memory as a running engine.

**Acceptance Scenarios**:

1. **Given** documentation updates are applied, **When** operators read runtime feature docs, **Then** they see Srclight as the code-intelligence engine and no active codebase-memory runtime path.
2. **Given** integration and workflow tests run, **When** assertions inspect active engines, **Then** tests pass without expecting codebase-memory services.

---

### Edge Cases

- What happens when a repository has stale runtime state files referencing codebase-memory? Runtime refresh rewrites live state from current supported engines and does not synthesize retired engine health.
- What happens when a user attempts to enable codebase-memory through config commands after retirement? The command reports unsupported engine identifier and does not mutate config.
- What happens when documentation references linger outside feature docs? Documentation validation must flag and update those references before merge.
- What happens when one-time migration detects legacy keys but cannot persist write-back? Config load fails with explicit remediation steps and does not continue with partially migrated state.
- What happens when migration succeeds but an automatic backup is expected by operators? The system does not create automatic backups and surfaces explicit messaging that users may create manual backups before rerunning.
- What happens when migrated legacy values conflict with existing Srclight values? Existing Srclight values are preserved and only missing Srclight fields are populated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST remove codebase-memory engine registration from active adapter enumeration.
- **FR-002**: The system MUST remove codebase-memory engine identity from supported engine configuration schema.
- **FR-003**: The system MUST remove codebase-memory default engine configuration from project initialization defaults.
- **FR-004**: Runtime compose rendering MUST no longer emit a codebase-memory service.
- **FR-005**: Engine command/image selection logic MUST no longer include codebase-memory runtime branches.
- **FR-006**: Discovery and unified routing behavior MUST continue to operate for code-intelligence through Srclight without codebase-memory dependency.
- **FR-007**: Adapter and runtime tests that previously depended on codebase-memory MUST be updated to the retired-engine model.
- **FR-008**: Documentation under runtime and MCP feature areas MUST remove active codebase-memory engine guidance.
- **FR-009**: Legacy project config containing codebase-memory engine keys MUST be migrated to Srclight-compatible configuration during config load.
- **FR-010**: The migration in FR-009 MUST be persisted by writing updated configuration once, after which subsequent loads MUST proceed without re-running migration for unchanged config.
- **FR-011**: If migration write-back cannot be persisted, config load MUST fail with actionable remediation guidance and MUST NOT proceed with partially migrated state.
- **FR-012**: Migration write-back MUST NOT create automatic backup files.
- **FR-013**: When legacy codebase-memory keys and existing Srclight keys overlap, existing Srclight values MUST take precedence and migrated values MUST only populate missing Srclight fields.

### Runtime Truth and Validation Requirements *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RTV-001**: Engine-owned capabilities MUST be discovered from live runtime endpoints and exercised successfully in acceptance scenarios.
- **RTV-002**: The system MUST NOT rely on hard-coded engine tool inventories to represent runtime availability.
- **RTV-003**: Required bootstrap/indexing steps MUST run automatically and MUST be verified before readiness is reported healthy.
- **RTV-004**: Degraded mode MUST report proven root cause, affected capabilities, and corrective actions based on live checks.
- **RTV-005**: Configuration-dependent limitations MUST be classified only after execution-based validation against the active runtime.
- **RTV-006**: Local/private execution MUST be preferred when a capable local option exists; hosted fallback usage MUST be explicit.
- **RTV-007**: Feature documentation under `docs/features/` MUST be updated with observed behavior, prerequisites, bootstrap flow, and degraded outcomes.

### Key Entities *(include if feature involves data)*

- **Engine Catalog**: The authoritative set of supported engine IDs used by schema validation, defaults, CLI toggles, and runtime wiring.
- **Adapter Registry**: The active list of engine adapters used to translate config, bootstrap engines, and resolve unified routes.
- **Runtime Service Topology**: The rendered compose service set and associated runtime health evidence files reflecting active engines only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Default project config contains zero references to codebase-memory engine blocks.
- **SC-002**: Runtime compose output contains zero codebase-memory services across validated startup flows.
- **SC-003**: Adapter registry and discovery outputs include zero codebase-memory adapter/tool registrations.
- **SC-004**: Existing code-intelligence integration flows continue to pass using Srclight as the active engine.
- **SC-005**: Legacy project configs containing codebase-memory engine keys are successfully auto-migrated and written back once in validation flows without runtime startup failure.
- **SC-006**: Subsequent config loads for already-migrated projects do not re-run migration and do not emit repeated migration warnings.
- **SC-007**: Migration validation confirms no automatic backup artifact is created during successful write-back.
- **SC-008**: Migration conflict tests confirm explicit Srclight values are preserved and only missing Srclight fields are backfilled from legacy config.

### Runtime Validation Outcomes *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RVO-001**: Tool discovery reports only live-discovered engine capabilities and zero synthetic retired-engine tools.
- **RVO-002**: Runtime readiness transitions to healthy only after required bootstrap/index jobs complete for remaining engines.
- **RVO-003**: Degraded engine states include explicit, reproducible diagnostics validated in test or workflow output.
- **RVO-004**: Documentation updates under `docs/features/` match observed command/runtime output used during validation.

## Assumptions

- Srclight provides sufficient code-intelligence capability coverage for current unified routing requirements.
- Auto-migration applies only to legacy persisted configuration and does not preserve codebase-memory as an active runtime engine.
- Config write permissions are available for normal project operation, and write failure paths are surfaced as explicit errors.
- Operators that require backups can perform manual backup steps prior to retrying migration.
- Existing explicit Srclight settings represent user intent and must be preserved during migration.
- Any historical references to codebase-memory in reports or archived documents may remain if clearly non-operational.
