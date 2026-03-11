# Contract: Runtime Upgrade CLI Surface

## Purpose

Define the project-local command surface for inspecting, migrating, repairing, and reconciling `.mimirmesh` installations without deleting preserved project intelligence.

## Commands

Project-local runtime upgrade flows are exposed separately from CLI self-update.

Expected commands:

- `mimirmesh runtime upgrade status`
- `mimirmesh runtime upgrade migrate`
- `mimirmesh runtime upgrade repair`
- `mimirmesh runtime refresh`

## Command Expectations

### `mimirmesh runtime upgrade status`

Reports whether the current `.mimirmesh` installation is:

- `current`
- `outdated`
- `repairable`
- `blocked`
- `degraded`

Output must include:

- current project-local version evidence
- target version implied by the installed CLI/runtime definitions
- whether automatic migration is allowed
- drift categories
- recommended next action

### `mimirmesh runtime upgrade migrate`

Runs ordered in-place upgrade steps for supported states.

Required behavior:

- back up critical metadata before mutation
- persist checkpoint progress
- reconcile generated runtime definitions with actual runtime state
- refresh only impacted services when possible
- rerun discovery after reconciliation
- rerun bootstrap only when compatibility or input drift requires it
- validate representative preserved assets before full health is reported

Possible outcomes:

- `success`: upgrade and preserved-state validation both succeeded
- `degraded`: core upgrade succeeded but some preserved assets were quarantined or require repair
- `blocked`: automatic migration is unsupported or unsafe
- `failed`: the active step could not complete or safely quarantine

### `mimirmesh runtime upgrade repair`

Repairs a project-local installation that is partially upgraded, degraded, or otherwise recoverable.

Required behavior:

- resume from the latest valid checkpoint when possible
- restore step-local backups only when needed for the active failing step
- avoid deleting compatible project intelligence
- report whether repair restored full health or only reduced degradation

### `mimirmesh runtime refresh`

Reconciles runtime definitions and services without implying a version migration when the current state is already compatible.

Required behavior:

- refresh generated compose/runtime definitions
- compare running runtime evidence against current definitions
- restart or rediscover only the services affected by drift
- avoid rebuilding preserved indexes or rerunning bootstrap unless drift rules require it

## Result Reporting

Command results must use the standard CLI outcome model:

- `success` for fully healthy completion
- `warning` for degraded but usable outcomes
- `error` for blocked or failed mutation paths

Structured details should include:

- version delta
- migration/repair step counts
- preserved asset counts by validation result
- affected engines and runtime actions

## Separation from CLI Self-Update

- `mimirmesh update` remains the CLI self-update surface.
- Project-local upgrade commands must not silently change the installed CLI version.
- CLI self-update alone must not be treated as proof that a project-local runtime is current.