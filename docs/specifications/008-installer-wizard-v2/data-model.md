# Data Model: Installer Wizard v2

## Installation Preset

- **Purpose**: Represents the starting configuration for a guided install session.
- **Fields**:
  - `id`: stable preset identifier
  - `label`: operator-facing preset name
  - `description`: concise explanation of what the preset enables
  - `recommended`: whether the preset should be highlighted as default guidance
  - `defaultAreas`: install areas enabled by default for the preset
- **Validation Rules**:
  - `id` must be unique within the preset catalog
  - `defaultAreas` may contain only supported install area identifiers

## Installation Area

- **Purpose**: Represents an installable area that can be enabled, skipped, or reviewed.
- **Fields**:
  - `id`: stable area identifier
  - `label`: operator-facing name
  - `kind`: required or optional
  - `description`: what the area configures
  - `selectionState`: selected, skipped, required, or unavailable
  - `nonInteractiveSelectable`: whether the area may be selected explicitly in automation
- **Validation Rules**:
  - Required areas cannot be disabled by presets or review adjustments
  - Optional areas must surface a reason when unavailable

## Installation Policy

- **Purpose**: Captures the final operator intent for a specific install run.
- **Fields**:
  - `presetId`: chosen preset identifier
  - `selectedAreas`: final set of enabled install areas
  - `explicitAreaOverrides`: operator adjustments made after preset selection
  - `mode`: interactive or non-interactive
  - `ideTargets`: IDE selections when IDE integration is enabled
  - `selectedSkills`: bundled skills requested as part of the install
- **Validation Rules**:
  - Non-interactive policy must include either `presetId` or explicit area selections
  - At least one IDE target is required when IDE integration area is enabled in non-interactive mode
  - When bundled skills are selected and no explicit skill list is provided, interactive install defaults to the bundled skill catalog while non-interactive install requires explicit `--skills` or a preset-driven default
  - Skill selections must be limited to bundled skill identifiers known at runtime

## Installation State Snapshot

- **Purpose**: Describes the current repository state before execution.
- **Fields**:
  - `projectRoot`: repository root
  - `completedAreas`: install areas already satisfied
  - `degradedAreas`: install areas needing remediation
  - `pendingAreas`: areas still to execute
  - `detectedArtifacts`: relevant files/configs/state entries used for install decisions, including per-area install-managed paths and whether they require explicit overwrite confirmation
  - `specKitStatus`: current Spec Kit readiness
  - `runtimeStatus`: current runtime health summary
- **Validation Rules**:
  - Completed/degraded/pending classifications must be derived from observed repository state
  - Required areas missing normative artifacts must not be marked completed

## Install Change Summary

- **Purpose**: Represents the changes that would be applied by the selected policy.
- **Fields**:
  - `createdFiles`: install-managed files/directories that will be created
  - `updatedFiles`: install-managed files that would be overwritten or modified
  - `skippedAreas`: areas intentionally not executed
  - `appliedAreas`: areas scheduled for execution
  - `warnings`: non-blocking concerns discovered during planning/execution
- **Validation Rules**:
  - `updatedFiles` entries require explicit interactive confirmation before execution or explicit `--yes` in non-interactive mode
  - Baseline install-managed directories that already exist but do not represent destructive updates must not be surfaced as `updatedFiles`
  - Summary must be reproducible from policy + state snapshot

## Installation Outcome

- **Purpose**: Final reported result for the install run.
- **Fields**:
  - `kind`: success, degraded, or failed
  - `completedAreas`: areas finished successfully
  - `skippedAreas`: areas intentionally not run
  - `degradedAreas`: areas completed with follow-up work still required
  - `blockedCapabilities`: user-visible capabilities currently unavailable
  - `nextAction`: operator guidance for follow-up
  - `evidence`: workflow evidence rows used in human and machine-readable output
- **Validation Rules**:
  - Outcome must remain semantically equivalent between human output and `--json`
  - Failed or degraded outcomes must identify impacted areas/capabilities and next actions

## State Transitions

- `Installation State Snapshot` -> `Installation Policy`: operator picks preset and reviews areas based on detected state
- `Installation Policy` + `Installation State Snapshot` -> `Install Change Summary`: system computes intended changes before execution
- `Install Change Summary` -> `Installation Outcome`: user confirms and workflow executes, yielding success/degraded/failed result
