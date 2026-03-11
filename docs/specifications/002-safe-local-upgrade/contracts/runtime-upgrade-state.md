# Contract: Runtime Upgrade State And Migration Evidence

## Purpose

Define the required project-local state evidence for version comparison, compatibility checks, migrations, backups, checkpoints, and degraded preserved-asset outcomes.

## Versioned Runtime Evidence

The upgrade system must persist explicit version evidence for:

- project-local runtime metadata schema
- engine runtime definition/rendering version
- compatibility window identifier used for automatic migration
- installed CLI version performing the latest comparison or migration

This evidence must live under `.mimirmesh/runtime/` and be machine-readable.

## Required State Files

The feature introduces or extends versioned evidence for:

- `.mimirmesh/runtime/connection.json`
- `.mimirmesh/runtime/health.json`
- `.mimirmesh/runtime/bootstrap-state.json`
- `.mimirmesh/runtime/routing-table.json`
- `.mimirmesh/runtime/engines/*.json`
- `.mimirmesh/runtime/upgrade-metadata.json`
- `.mimirmesh/runtime/upgrade-checkpoint.json`
- `.mimirmesh/runtime/upgrade-backups.json`

Additional engine-owned persisted assets may remain in their native locations, such as repo-local `.srclight/`, but their compatibility classification must still be represented in project-local upgrade evidence.

## Backup Rules

Before any migration mutates critical metadata, the system must create restorable backups for:

- `.mimirmesh/config.yml` when upgrade logic changes config-adjacent runtime fields
- runtime metadata files under `.mimirmesh/runtime/*.json`
- engine runtime state files under `.mimirmesh/runtime/engines/*.json`

Backups must be discoverable from the backup manifest and attributable to a single upgrade attempt.

## Checkpoint Rules

Checkpoint state must record:

- upgrade attempt identifier
- target version
- active step
- ordered completed steps
- quarantined/degraded steps
- blocking failure reason, if any
- whether resume is allowed

Completed safe steps remain committed across retries. Checkpoints must never imply that the whole installation was rolled back when only the active step was reverted or quarantined.

## Compatibility Rules

- Automatic migration is allowed only for states inside the declared compatibility window.
- Older or unknown states outside that window must be preserved without destructive mutation.
- Indexes and caches must be classified as `compatible`, `migrate`, `rebuild`, or `blocked` according to explicit rules.
- Status and repair flows must use both stored version evidence and observed state shape to determine compatibility.

## Preserved Asset Validation Rules

Post-upgrade validation must combine:

- metadata/version checks
- on-disk presence checks
- targeted live checks against representative preserved assets

If representative preserved assets fail validation while core runtime reconciliation succeeds:

- the upgrade outcome is `degraded`
- only invalid assets are quarantined or disabled
- the remaining compatible state stays intact
- full healthy status is withheld until repair succeeds

## Health And Readiness Rules

- Runtime readiness is healthy only after required migrations, runtime reconciliation, discovery, selective bootstrap, and preserved-state validation complete.
- Degraded upgrade outcomes must report the real failing asset classes and recommended repair action.
- Blocked outcomes must report why automatic migration is unsupported or unsafe.