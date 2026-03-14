# Runtime Upgrade

MímirMesh now upgrades project-local `.mimirmesh` state in place instead of requiring users to delete the runtime directory.

## Runtime Evidence

Project-local upgrade evidence is stored under `.mimirmesh/runtime/`:

- `version.json`
- `upgrade-metadata.json`
- `upgrade-checkpoint.json`
- `upgrade-backups.json`

Version evidence records the CLI/runtime version, runtime schema version, engine definition version, compatibility window, and the command that last wrote the record.

## Command Surface

- `mimirmesh upgrade`
- `mimirmesh runtime upgrade status`
- `mimirmesh runtime upgrade migrate`
- `mimirmesh runtime upgrade repair`
- `mimirmesh runtime refresh`
- `mimirmesh runtime doctor`
- `mimirmesh runtime status`

Mutating runtime upgrade commands are guided by default in interactive
terminals. `upgrade`, `runtime upgrade migrate`, and `runtime upgrade repair`
now explain consequences before proceeding and require `--non-interactive`
when invoked from automation or another non-interactive terminal.

`mimirmesh update` remains the CLI self-update flow and does not imply that a project-local runtime is current.

## Upgrade Model

- Upgrades use ordered runtime migrations with persisted checkpoints.
- Each step writes a step-local backup snapshot before mutation.
- Completed steps stay committed.
- A failed active step restores only its own pre-step snapshot.
- Preserved assets are validated after reconcile using targeted checks for runtime metadata, reports, writable notes/memory, sqlite-backed indexes, engine state, and compose definitions.
- Invalid preserved assets are quarantined individually and the runtime is reported as `degraded` until repair succeeds.

## Compatibility Window

Automatic migration is supported only inside the declared runtime compatibility window. Out-of-window or unknown state is preserved in place and reported as `blocked` with `manual-intervention`.

## Observed Validation

The quickstart validation scenarios were exercised with simulated current, outdated, repairable, degraded, and blocked fixtures.

Observed results:

- Current fixture: `mimirmesh runtime upgrade status` reported `current`.
- Current fixture: `mimirmesh runtime upgrade migrate` completed without deleting `.mimirmesh`.
- Supported old fixture: `mimirmesh runtime upgrade status` reported `outdated`, then `mimirmesh runtime upgrade migrate` advanced `version.json` to runtime schema version `4`.
- Repairable fixture: `mimirmesh runtime upgrade repair` resumed from persisted checkpoint evidence and completed successfully.
- Blocked fixture: `mimirmesh runtime upgrade status` reported `blocked` and recommended manual intervention without mutating state.
- Degraded fixture: preserved-asset failures were isolated as degraded validation output rather than reported as a full upgrade failure.

Observed command/output delta from the quickstart:

- `mimirmesh runtime refresh` and `mimirmesh runtime upgrade migrate` do not auto-start a stopped runtime just because Docker is available. They reconcile metadata and only refresh already-started services. Explicit lifecycle start remains `mimirmesh runtime start`.

## Repair Guidance

Use `mimirmesh runtime doctor` to validate preserved assets without quarantining them.

Use `mimirmesh runtime upgrade repair` when:

- an upgrade was interrupted and a checkpoint is resumable
- preserved assets were quarantined and the runtime is degraded
- upgrade status reports `repairable`

All runtime upgrade commands now conclude with a terminal outcome classified as
`success`, `degraded`, or `failed`, including blocked capability and next
action sections so partial-success cases are explicit.
