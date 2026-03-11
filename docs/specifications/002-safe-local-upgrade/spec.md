# Feature Specification: Safe Project-Local Upgrade

**Feature Branch**: `[002-safe-local-upgrade]`  
**Created**: 2026-03-13  
**Status**: Draft  
**Input**: User description: "Add a safe project-local upgrade capability for MímirMesh so users can update an existing .mimirmesh installation in place without deleting it and losing local context, indexes, reports, notes, runtime metadata, or other project intelligence. The upgrade flow must preserve valid local state by default, detect when migrations are required, apply compatible upgrades automatically where possible, and clearly report when manual intervention is required. Users must be able to update runtime components such as engine containers, runtime metadata, and local state structures while keeping existing project knowledge intact. The feature must also provide a way to inspect upgrade status, determine whether the current project runtime is outdated, and repair or migrate an existing .mimirmesh directory when its stored state is behind the current MímirMesh version."

## Clarifications

### Session 2026-03-13

- Q: How should preserved local state be validated after an upgrade? → A: Validate metadata, on-disk presence, and usability of preserved state through targeted live checks on representative assets such as indexes, reports, notes, and runtime metadata.
- Q: What failure-recovery model should the upgrade flow use? → A: Use a resumable checkpointed upgrade where each migration step is atomic, completed steps remain committed, and only the in-progress unsafe step is rolled back or quarantined.
- Q: What backward-compatibility window should automatic migration support? → A: Support automatic migration only from a defined compatible version window; older or unknown versions are preserved but require manual intervention.
- Q: How should the system report preserved assets that fail post-upgrade validation? → A: Mark the upgrade as completed but degraded, quarantine or disable only the invalid preserved assets, and require repair before reporting full health.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upgrade In Place Without Losing Project Knowledge (Priority: P1)

As a project maintainer, I can upgrade an existing project-local MímirMesh installation in place so that runtime components and stored project intelligence stay usable without deleting `.mimirmesh` or rebuilding everything from scratch.

**Why this priority**: Preserving local state during upgrades is the core user value. If upgrading requires deleting the project runtime, the feature fails its primary purpose.

**Independent Test**: Can be fully tested by starting from an older but valid `.mimirmesh` directory containing indexes, reports, notes, and runtime metadata, running the upgrade flow, and confirming the project remains usable with preserved state and refreshed runtime components.

**Acceptance Scenarios**:

1. **Given** a project contains a valid but outdated `.mimirmesh` directory, **When** the user runs the project-local upgrade flow, **Then** the system upgrades compatible runtime components in place and preserves existing project intelligence by default.
2. **Given** the project contains stored indexes, reports, notes, and runtime metadata that are still compatible, **When** the upgrade completes, **Then** those assets remain available without requiring manual export, deletion, or recreation.
3. **Given** part of the stored state requires a migration to remain valid under the current version, **When** the upgrade runs, **Then** the system applies the supported migration automatically before reporting success.

---

### User Story 2 - Inspect Upgrade Readiness and Drift (Priority: P2)

As a project maintainer, I can inspect whether the current `.mimirmesh` directory is current, outdated, partially upgraded, or incompatible so that I know whether an upgrade or repair action is needed before runtime issues appear.

**Why this priority**: Users need trustworthy upgrade status before they mutate local state. Clear drift reporting reduces accidental breakage and unnecessary reinstall behavior.

**Independent Test**: Can be fully tested by evaluating multiple project states, including current, outdated, and incompatible runtime metadata, and confirming the status command classifies each state correctly and explains what action is needed.

**Acceptance Scenarios**:

1. **Given** a project-local `.mimirmesh` directory matches the current expected state, **When** the user requests upgrade status, **Then** the system reports that no upgrade is required.
2. **Given** a project-local `.mimirmesh` directory is behind the current expected state, **When** the user requests upgrade status, **Then** the system reports that the project runtime is outdated and identifies the categories of state that require upgrade or migration.
3. **Given** a project-local `.mimirmesh` directory contains incompatible or incomplete upgrade state, **When** the user requests upgrade status, **Then** the system reports the issue, the risk to project usability, and the recommended corrective action.

---

### User Story 3 - Repair or Migrate Existing Local State (Priority: P3)

As a project maintainer, I can repair or migrate an existing `.mimirmesh` directory that is behind the current version or partially broken so that I can recover project-local intelligence without wiping the installation.

**Why this priority**: Recovery matters after the safe upgrade path exists, but it is secondary to the standard in-place upgrade flow.

**Independent Test**: Can be fully tested by introducing an older or partially inconsistent project-local state, invoking repair or migration, and confirming the system restores the installation to a supported state or clearly stops with manual remediation guidance.

**Acceptance Scenarios**:

1. **Given** the project-local state is behind the current version but still repairable, **When** the user runs a repair or migration action, **Then** the system brings the stored state to a supported version without deleting preserved project knowledge.
2. **Given** the project-local state contains a condition that cannot be repaired automatically, **When** the repair or migration action runs, **Then** the system stops before destructive changes, preserves recoverable state, and reports the manual intervention required.

### Edge Cases

- What happens when an upgrade is interrupted after some runtime components are refreshed but before state migration completes?
- How does the system handle project intelligence that is valid to preserve but temporarily unusable until a follow-on migration finishes?
- What happens when the project contains state from a version that is too old or too new for automatic migration rules?
- How does the system respond when required upgrade artifacts are unavailable, while the existing `.mimirmesh` installation is still usable?
- What happens when stored runtime metadata says the installation is current but the actual local state shape is behind or partially corrupted?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a project-local upgrade capability for an existing `.mimirmesh` directory that updates the installation in place without requiring the user to delete the directory first.
- **FR-002**: The system MUST preserve valid project-local intelligence by default during upgrade, including indexes, reports, notes, runtime metadata, and other stored project context that remains compatible.
- **FR-003**: The system MUST determine whether the current project-local installation is current, outdated, partially upgraded, incompatible, or repairable before applying upgrade changes.
- **FR-004**: The system MUST detect when stored state or runtime metadata requires migration in order to remain valid under the current MímirMesh version.
- **FR-005**: The system MUST automatically apply supported migrations needed for a safe upgrade when the required conditions for those migrations are satisfied.
- **FR-006**: The system MUST refresh upgradeable runtime components, including project-scoped runtime assets and stored runtime metadata, without discarding compatible project knowledge.
- **FR-007**: The system MUST provide a status inspection capability that reports whether the current `.mimirmesh` installation is outdated and what categories of action are required.
- **FR-008**: The system MUST provide a repair or migrate capability for existing `.mimirmesh` directories whose stored state is behind the current version but still recoverable.
- **FR-009**: The system MUST stop before destructive state loss when it encounters an unsupported or unsafe migration path and MUST preserve recoverable local state.
- **FR-010**: The system MUST clearly report the outcome of upgrade, migration, or repair actions, including completed changes, preserved state, skipped actions, warnings, and any manual intervention required.
- **FR-011**: The system MUST make upgrade decisions from stored project-local version and state evidence rather than assuming deletion and reinstallation is the safe default.
- **FR-012**: The system MUST distinguish between changes that can be applied automatically and changes that require explicit user action because of incompatibility, corruption, or missing prerequisites.
- **FR-013**: The system MUST leave the existing project-local installation usable when an upgrade cannot be fully completed, unless continuing to use it would be unsafe and that risk is reported explicitly.
- **FR-014**: The system MUST validate preserved local state after upgrade using version evidence, on-disk presence checks, and targeted live usability checks against representative preserved assets rather than relying only on metadata markers.
- **FR-015**: The system MUST NOT require full regeneration of all preserved local state before reporting upgrade success when targeted validation proves representative preserved assets remain usable.
- **FR-016**: The system MUST execute upgrade and migration work as resumable checkpointed steps whose completed safe steps remain committed across interruption or retry.
- **FR-017**: The system MUST roll back or quarantine only the in-progress unsafe step when a failure occurs, rather than attempting a full installation-wide rollback that could endanger preserved project-local knowledge.
- **FR-018**: The system MUST persist enough checkpoint and outcome evidence for a later run to resume, repair, or clearly report the exact upgrade step that failed.
- **FR-019**: The system MUST define and enforce a compatible automatic migration window for project-local state versions and runtime metadata versions.
- **FR-020**: The system MUST preserve older or unknown `.mimirmesh` states outside the supported automatic migration window without mutating them destructively and MUST require manual intervention for those cases.
- **FR-021**: The system MUST report an upgrade as completed but degraded when representative preserved assets fail post-upgrade validation even though the core upgrade steps succeeded.
- **FR-022**: The system MUST quarantine or disable only the invalid preserved assets that fail post-upgrade validation and MUST require repair before reporting full healthy status.
- **FR-023**: The system MUST distinguish degraded preserved-state outcomes from full upgrade failure so users can see which runtime changes succeeded and which preserved assets require repair.

### Runtime Truth and Validation Requirements *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RTV-001**: Upgrade status and execution results MUST be derived from the actual project-local installation state and live runtime checks rather than static assumptions about version compatibility.
- **RTV-002**: The system MUST validate the real presence and condition of upgradeable runtime components before reporting that an installation is current or successfully upgraded.
- **RTV-003**: Required migration and repair steps MUST be executed and verified before the installation is reported as healthy under the current version.
- **RTV-004**: Degraded or blocked upgrade states MUST report the proven root cause, affected project-local capabilities, preserved state, and corrective actions.
- **RTV-005**: Manual intervention guidance MUST be produced only after the system confirms that automatic upgrade or repair is unsafe or unsupported for the current stored state.
- **RTV-006**: Project-local preservation MUST be preferred over reinstall behavior whenever the existing state can be validated or migrated safely.
- **RTV-007**: Post-upgrade validation MUST exercise representative preserved assets through targeted live checks so the system can prove preserved indexes, reports, notes, and runtime metadata remain usable.
- **RTV-008**: Upgrade validation MUST prove that interrupted or failed runs can resume from recorded checkpoints without redoing already committed safe steps or discarding preserved compatible state.
- **RTV-009**: Feature documentation under `docs/features/` MUST be updated with observed upgrade behavior, status inspection behavior, migration outcomes, prerequisites, and degraded cases.
- **RTV-010**: Status inspection and upgrade validation MUST distinguish supported automatic migrations from out-of-window or unknown-version states using stored version evidence and observed state shape.
- **RTV-011**: Post-upgrade validation MUST prove that invalid preserved assets are isolated without misreporting the entire installation as fully healthy or fully failed when only a subset of preserved assets is degraded.

### Key Entities *(include if feature involves data)*

- **Project Runtime Installation**: The project-scoped `.mimirmesh` directory and its stored runtime assets, metadata, and project intelligence that must be assessed, upgraded, and preserved.
- **Upgrade Status Report**: A user-facing assessment of whether the current installation is current, outdated, partially upgraded, incompatible, or repairable, along with required actions and risks.
- **Migration Step**: A version-sensitive transformation that brings stored project-local state or metadata from an older supported shape to the current supported shape.
- **Repair Action**: A recovery action that restores a damaged or incomplete project-local installation to a supported state without discarding valid project intelligence unnecessarily.
- **Upgrade Outcome**: The recorded result of an upgrade, repair, or migration attempt, including completed changes, preserved assets, warnings, failures, and manual steps.

### Assumptions

- Existing `.mimirmesh` directories are project-scoped and are the authoritative location for retained runtime state and project intelligence.
- Most upgrades occur inside a defined supported compatibility window, so automatic migration is the default only for stored states whose version and structure fall inside that window.
- Some historic or corrupted states will not be safe to migrate automatically and must remain preserved for manual intervention instead of being deleted.
- Users need visibility into upgrade status before and after running upgrade actions, not only after a failure occurs.

### Dependencies and Scope Boundaries

- The feature depends on trustworthy project-local version or state evidence being available inside the existing `.mimirmesh` installation.
- The feature depends on upgrade artifacts for the current MímirMesh release being available to the local project runtime when an upgrade is attempted.
- The feature covers project-local upgrade, status inspection, migration, and repair of `.mimirmesh` state.
- The feature does not require deleting and recreating the project-local installation as the normal upgrade path.
- The feature does not cover recovery of project intelligence that has already been permanently deleted before the upgrade flow begins.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In at least 95% of supported upgrade cases, users can upgrade an existing `.mimirmesh` installation in one run without deleting project-local state.
- **SC-002**: In 100% of successful supported upgrades, previously valid indexes, reports, notes, and runtime metadata remain available after upgrade completion.
- **SC-003**: Users can determine whether a project-local installation is current or outdated in under 30 seconds from invoking the status inspection flow.
- **SC-004**: In 100% of unsupported or unsafe migration cases, the system stops before destructive loss of recoverable project-local intelligence and reports the required manual action.
- **SC-005**: At least 90% of repairable behind-version installations can be brought to a supported state without requiring full reinstallation.
- **SC-006**: In 100% of successful upgrades, representative preserved assets pass targeted post-upgrade usability checks without requiring full regeneration of all local state.
- **SC-007**: In at least 95% of interrupted supported upgrades, a subsequent retry resumes from recorded checkpoints and completes without requiring manual reconstruction of already preserved state.
- **SC-008**: In 100% of detected out-of-window or unknown-version installations, the system preserves recoverable state and reports that automatic migration is unsupported.
- **SC-009**: In 100% of cases where representative preserved assets fail validation after a successful core upgrade, the system reports degraded status, isolates only the invalid assets, and preserves the remaining compatible state.

### Runtime Validation Outcomes *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RVO-001**: Validation proves that upgrade status classifications match the observed condition of representative current, outdated, repairable, and blocked `.mimirmesh` installations.
- **RVO-002**: Validation proves that successful upgrade flows report healthy readiness only after required runtime refresh and state migration steps complete.
- **RVO-003**: Validation proves that failed or blocked upgrade flows preserve recoverable project-local state and emit explicit diagnostics tied to the observed root cause.
- **RVO-004**: Validation proves that successful upgrades include targeted live checks against representative preserved assets and that those checks match the reported preserved-state outcome.
- **RVO-005**: Validation proves that interrupted and retry-based upgrade flows resume from persisted checkpoints and avoid re-running already committed safe steps.
- **RVO-006**: Documentation updates under `docs/features/` match observed status, upgrade, migration, and repair behavior used during validation.
- **RVO-007**: Validation proves that installations outside the supported automatic migration window are classified correctly, preserved non-destructively, and blocked from unsafe automatic migration.
- **RVO-008**: Validation proves that post-upgrade preserved-asset failures produce degraded status, isolate only the failed preserved assets, and keep successful upgrade changes and remaining valid preserved state intact.
