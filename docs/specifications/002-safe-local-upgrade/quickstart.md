# Quickstart: Validate Safe Project-Local Upgrade

## 1. Prepare an upgradeable project fixture

- Start with an initialized project that already contains `.mimirmesh/config.yml`, `.mimirmesh/runtime/*`, reports, notes, and at least one engine-owned persisted asset such as a Srclight index.
- Ensure the fixture represents an older but supported project-local state version for the primary validation path.
- Keep a second fixture with an out-of-window or intentionally inconsistent state for blocked/repair validation.

## 2. Inspect upgrade status before mutation

Run the project-local status flow:

- `mimirmesh runtime upgrade status`

Verify that the command reports:

- current recorded project-local version evidence
- target version implied by the installed CLI/runtime definitions
- whether automatic migration is allowed
- drift categories across runtime metadata, engine definitions, and preserved assets
- whether the installation is `current`, `outdated`, `repairable`, `blocked`, or already `degraded`

## 3. Run a no-op upgrade validation

Use a current fixture and confirm:

- `mimirmesh runtime upgrade migrate` does not delete `.mimirmesh`
- no unnecessary container rebuild or bootstrap rerun occurs
- backup/checkpoint metadata remains coherent
- final runtime state stays healthy

## 4. Run an in-place supported upgrade

Use the older supported fixture and run:

- `mimirmesh runtime upgrade migrate`

Verify that the upgrade:

- creates backups for critical runtime metadata before mutation
- records ordered checkpoint progress in `.mimirmesh/runtime/`
- regenerates compose/runtime definitions
- refreshes only impacted runtime services
- reruns discovery after reconciliation
- reruns bootstrap only when version or input drift requires it
- preserves compatible notes, memory, reports, and engine state by default

## 5. Inspect post-upgrade runtime evidence

Review the upgraded project-local state:

- `.mimirmesh/runtime/health.json`
- `.mimirmesh/runtime/connection.json`
- `.mimirmesh/runtime/bootstrap-state.json`
- `.mimirmesh/runtime/routing-table.json`
- `.mimirmesh/runtime/engines/*.json`
- new upgrade metadata/checkpoint/backup manifest files defined by the feature

Expected base outcome:

- explicit runtime/state version evidence is present
- the checkpoint shows completed ordered steps
- the runtime reports healthy only after required discovery/bootstrap/validation complete
- preserved-state validation evidence is recorded

## 6. Validate preserved assets truthfully

Confirm targeted live checks on representative preserved assets succeed, such as:

- loading a preserved report
- reading preserved notes or memory files
- querying a preserved engine index when compatibility rules say it should remain usable
- verifying runtime metadata can still drive status and routing

If one representative preserved asset fails while core runtime reconciliation succeeds, confirm the installation reports `degraded`, quarantines only the invalid asset, and recommends `mimirmesh runtime upgrade repair`.

## 7. Validate repair and blocked behavior

For repairable inconsistent state:

- run `mimirmesh runtime upgrade repair`
- confirm the system resumes from checkpoints or applies repair migrations without deleting compatible project knowledge

For out-of-window or unknown state:

- run `mimirmesh runtime upgrade status`
- confirm the system classifies the project as blocked, preserves existing state in place, and reports manual intervention requirements without destructive mutation

## 8. Update runtime-facing documentation from observed behavior

After validation, update:

- `docs/features/runtime-upgrade.md`
- `docs/features/cli-command-surface.md`
- `docs/operations/runtime.md`
- `docs/runbooks/first-init.md`

Documentation must record:

- command surface and expected outcomes
- versioning and compatibility rules
- backup/checkpoint behavior
- selective runtime reconciliation behavior
- degraded preserved-state outcomes and repair guidance