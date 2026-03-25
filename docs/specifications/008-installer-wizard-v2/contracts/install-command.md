# Contract: `mimirmesh install`

## Purpose

Defines the external CLI contract for the unified umbrella install command introduced by Installer Wizard v2.

## Command Surface

### Canonical command

```text
mimirmesh install
```

### Supported execution modes

| Mode | Expected Behavior |
|------|-------------------|
| Interactive terminal | Guides the operator through preset selection, install-area review, and overwrite confirmation when needed before executing the workflow |
| Non-interactive terminal | Requires explicit preset or explicit install-area selections; otherwise exits with a failed workflow outcome and actionable rerun guidance |
| Machine-readable | Uses `--json` and returns the same workflow semantics as human output with a structured payload |

## Inputs

### Interactive inputs

| Input | Requirement |
|------|-------------|
| Installation preset | Required starting choice |
| Preset detail panel | Required; focused preset shows a short explanation before submission |
| Install-area review | Required review step allowing adjustments to optional areas |
| Overwrite confirmation | Required only when install-managed files would be modified |
| Optional integration details | Required only for selected areas that need specific targets, such as IDE integration |

### Non-interactive inputs

| Input | Requirement |
|------|-------------|
| Explicit preset | Required unless explicit per-area selections are supplied |
| Explicit per-area selections | Required unless preset is supplied |
| Area-specific values | Required whenever a selected area cannot execute safely without them; IDE integration accepts one or more comma-separated targets |
| `--yes` | Optional; auto-confirms install-managed updates for non-interactive reruns and CI paths |
| `--json` | Optional; enables machine-readable workflow output |

## Install Areas

The command contract must support an umbrella install flow that can represent at least these install areas:

| Area | Category | Notes |
|------|----------|-------|
| Core repository install | Required | Covers docs scaffolding, runtime files, report generation, repository analysis, and readiness validation |
| IDE integration | Optional | Includes install target selection when enabled |
| Bundled skills | Optional | Includes bundled skill selection/install behavior |
| Additional optional integrations | Optional | Must fit the same review and machine-readable contract |

## Output Contract

### Human-readable default

The command must render the standard workflow presentation with:

- workflow title and description
- prompt context for consequential decisions
- visible step progress
- warnings and evidence rows
- terminal outcome of `success`, `degraded`, or `failed`
- impact, completed work, blocked capabilities, and next action

### Machine-readable mode

When `--json` is requested, output must preserve the standard workflow envelope and include a payload that exposes at least:

| Field | Meaning |
|------|---------|
| `selectedPreset` | Final preset chosen for the run |
| `selectedAreas` | Final install areas enabled for execution |
| `selectedIdeTargets` | Final IDE targets enabled for execution |
| `completedAreas` | Areas completed successfully |
| `skippedAreas` | Areas intentionally skipped |
| `degradedAreas` | Areas requiring follow-up |
| `updatedFiles` | Install-managed files that were confirmed for overwrite |
| `runtimeStatus` | Final readiness summary after execution |
| `summary` | Install change summary describing created paths, updated paths, skipped areas, and warnings |

## Failure / Degraded Semantics

| Condition | Required Outcome |
|----------|------------------|
| Missing explicit choices in non-interactive mode | `failed` with rerun guidance that explains how to specify a preset or explicit areas |
| Non-interactive rerun without `--yes` when install-managed updates are pending | `failed` with rerun guidance that explains how to review interactively or pass `--yes` |
| Runtime readiness not achieved | `degraded` or `failed` based on the existing runtime workflow semantics, with evidence and next action |
| Operator declines overwrite confirmation | Non-destructive outcome that preserves existing files and explains what was skipped |
| Optional area unavailable | `degraded` or skipped state with area-specific reason and next action |

## Legacy Command Removal

`mimirmesh init` and `mimirmesh setup` are not part of the supported command contract after this feature. The supported onboarding surface is `mimirmesh install`.
