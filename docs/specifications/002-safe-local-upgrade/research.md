# Phase 0 Research: Safe Project-Local Upgrade

## Decision 1: Keep upgrade orchestration inside existing `packages/runtime` and `packages/config` modules

**Decision**: Implement project-local upgrade logic as new runtime/config submodules rather than creating a new top-level package.

**Rationale**: The repository already has strong lifecycle ownership in `packages/runtime` and schema ownership in `packages/config`. A separate package would be a thin wrapper around those capabilities and would violate the repo’s composition-over-abstraction guidance.

**Alternatives considered**:
- Create a new `packages/upgrade` package: rejected because it would mostly proxy runtime/config behavior and add package boundary churn without a distinct reuse case.
- Put all upgrade behavior directly in `apps/cli`: rejected because the logic must be reusable for tests and future server-side orchestration and therefore belongs in packages.

## Decision 2: Introduce explicit version stamps for config-adjacent runtime state, engine runtime definitions, and persisted indexes

**Decision**: Add explicit version and generator metadata to project-local runtime state artifacts, including runtime metadata files, engine state files, upgrade metadata, and compatibility descriptors for persisted indexes/caches.

**Rationale**: The existing runtime state files record timestamps and hashes but do not tell the system which MímirMesh version or schema produced them. Upgrade safety depends on comparing installed CLI version, local runtime/state version, and asset compatibility without guessing from shape alone.

**Alternatives considered**:
- Infer compatibility from file presence and field shape only: rejected because shape-only detection is too weak for ordered migrations and future-proof compatibility windows.
- Track version only in `.mimirmesh/config.yml`: rejected because upgrade decisions also depend on runtime evidence files and persisted engine/index artifacts that can drift independently of config.

## Decision 3: Persist upgrade checkpoints and outcome evidence in dedicated runtime files under `.mimirmesh/runtime/`

**Decision**: Introduce dedicated upgrade metadata, checkpoint, and backup manifest files under `.mimirmesh/runtime/` so interrupted upgrades can resume and report precise failure context.

**Rationale**: Current runtime state persistence already treats `.mimirmesh/runtime/*` as normative evidence for health, routing, and bootstrap. Upgrade checkpoints belong beside that evidence so status and repair flows can interpret the full installation state consistently.

**Alternatives considered**:
- Store checkpoint state only in logs: rejected because logs are not authoritative machine-readable runtime evidence.
- Reuse `bootstrap-state.json` for upgrade progress: rejected because bootstrap state tracks engine initialization only and would conflate runtime startup with migration sequencing.

## Decision 4: Use a defined compatibility window for automatic migrations and preserve out-of-window states without destructive mutation

**Decision**: Automatic migrations run only for versions inside a declared compatibility window. Older or unknown states are classified as blocked, preserved in place, and routed to manual repair guidance.

**Rationale**: The feature must preserve project intelligence safely. Attempting automatic migration for arbitrarily old or unknown states increases corruption risk and makes degraded reporting untrustworthy.

**Alternatives considered**:
- Attempt automatic migration from any detectable older state: rejected because unsupported historic states would produce unsafe guesses.
- Support only the immediately previous version: rejected because it is unnecessarily narrow and would create needless manual intervention for safe adjacent minor upgrades.

## Decision 5: Model upgrades as ordered, resumable checkpoints with per-step atomicity and targeted rollback/quarantine

**Decision**: Execute upgrade work as checkpointed steps. Completed safe steps remain committed, only the active unsafe step is rolled back or quarantined on failure, and retry resumes from the last incomplete checkpoint.

**Rationale**: Project-local upgrades cross metadata mutation, compose regeneration, service restarts, discovery, bootstrap, and preserved-state validation. Full transactional rollback is impractical, while unmanaged partial completion is unsafe.

**Alternatives considered**:
- Full installation-wide rollback on any failure: rejected because runtime/container changes and preserved assets do not share a single transactional boundary.
- Best-effort mutation with no checkpoint/resume evidence: rejected because it fails the recovery and truthfulness requirements.

## Decision 6: Replace destructive rebuild behavior with explicit runtime reconciliation based on drift detection

**Decision**: Reconcile runtime state by regenerating compose, comparing image tags/config hashes/bootstrap inputs, refreshing only impacted services, rerunning discovery after reconciliation, and rerunning bootstrap only when version or state checks require it.

**Rationale**: Existing runtime lifecycle already has the primitives for compose generation, Docker operations, discovery, bootstrap, and health persistence. Upgrade should build on those primitives and add drift-aware sequencing instead of deleting `.mimirmesh` or forcing full rebuilds on every change.

**Alternatives considered**:
- Stop everything and rebuild all services on every upgrade: rejected because it destroys useful continuity and ignores no-op/partial upgrade scenarios.
- Limit upgrade to metadata migrations only: rejected because engine image/runtime definition drift is part of the user requirement.

## Decision 7: Treat persisted indexes and caches as either migratable assets or rebuildable assets using explicit compatibility rules

**Decision**: Each engine-owned persisted asset class must declare whether it is directly compatible, requires migration, or must be rebuilt. Indexes and caches are preserved whenever compatibility rules say they remain valid; otherwise they are marked rebuildable rather than silently trusted.

**Rationale**: Notes, memory, and reports are generally preservable documents, while indexes and caches may depend on engine versions or schema changes. The upgrade system needs explicit rules to avoid both needless data loss and false health claims.

**Alternatives considered**:
- Preserve all indexes and caches unconditionally: rejected because index formats can drift across engine/runtime versions.
- Rebuild all indexes and caches unconditionally: rejected because it discards valuable local work and violates the safe in-place upgrade goal.

## Decision 8: Validate preserved local state with targeted live checks and report degraded preserved-state outcomes truthfully

**Decision**: After reconciliation, validate preserved state using version evidence, on-disk presence checks, and targeted live usability checks against representative assets. If only some preserved assets fail validation, mark the installation upgraded-but-degraded, quarantine only the invalid assets, and require repair before reporting full health.

**Rationale**: Metadata-only validation is too weak, and full regeneration defeats preservation. Targeted live checks provide truthful evidence while respecting project-local continuity.

**Alternatives considered**:
- Treat any preserved-asset validation failure as full upgrade failure: rejected because core runtime changes may still be correct and usable.
- Ignore preserved-asset validation failures if runtime services are healthy: rejected because it would misreport the usability of local project intelligence.

## Decision 9: Add project-facing CLI commands under the runtime surface and keep CLI self-update separate

**Decision**: Extend the runtime command surface with explicit project upgrade commands for status, migrate, repair, and refresh/reconcile, while keeping the existing CLI self-update command focused on updating the MímirMesh executable itself.

**Rationale**: The repo already has `mimirmesh update` for self-update. Project-local upgrade must be a different surface so users can distinguish binary updates from per-project runtime/state reconciliation.

**Alternatives considered**:
- Reuse `mimirmesh update` for project runtime changes: rejected because it would conflate application updates with project state mutation.
- Hide all upgrade behavior behind `doctor`: rejected because diagnostics and mutation should remain separate actions.

## Decision 10: Validate the feature with package-local versioning/migration tests plus workflow coverage using outdated `.mimirmesh` fixtures

**Decision**: Add package-local tests for version comparison, migration ordering, checkpoint persistence, backup/restore, and preserved-asset classification; integration tests for no-op upgrade, incompatible-state detection, and reconciliation; and workflow tests that upgrade an initialized project without deleting `.mimirmesh`.

**Rationale**: This feature changes runtime truth, filesystem mutation, and project lifecycle behavior. It needs deeper validation than a single CLI test because failures can be partial and environment-dependent.

**Alternatives considered**:
- Rely only on workflow tests: rejected because low-level migration rules and backup behavior need faster, deterministic unit coverage.
- Rely only on package tests: rejected because the user requirement explicitly includes end-to-end upgrade behavior through the project lifecycle.