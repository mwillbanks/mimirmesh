# Data Model: Safe Project-Local Upgrade

## Entity: ProjectRuntimeVersionRecord

**Purpose**: Records the version identity of the current project-local installation and the schemas that govern runtime state and engine-owned persisted assets.

**Fields**:
- `cliVersion`: installed MímirMesh CLI version performing the comparison or upgrade
- `runtimeSchemaVersion`: version of the `.mimirmesh/runtime/*` metadata schema
- `engineDefinitionVersion`: version of the generated runtime/engine definitions and compose rendering rules
- `stateCompatibilityVersion`: compatibility window identifier used to decide whether migrations may run automatically
- `recordedAt`: timestamp of the last version evidence write
- `generatedBy`: command/action that persisted the record

**Validation Rules**:
- All version fields must be non-empty.
- `runtimeSchemaVersion` and `engineDefinitionVersion` must be parseable by the upgrade compatibility logic.
- The record must exist before the installation can be reported as current.

## Entity: UpgradeStatusReport

**Purpose**: User-facing classification of whether a `.mimirmesh` installation is current, outdated, repairable, blocked, or upgraded-but-degraded.

**Fields**:
- `state`: `current`, `outdated`, `repairable`, `blocked`, or `degraded`
- `currentVersion`: current recorded project-local version evidence
- `targetVersion`: version implied by the installed CLI/runtime definitions
- `automaticMigrationAllowed`: boolean derived from the compatibility window
- `requiredActions`: ordered list of `none`, `refresh-runtime`, `migrate-state`, `repair-state`, `manual-intervention`
- `driftCategories`: list such as `runtime-metadata`, `compose-definition`, `engine-image`, `bootstrap-input`, `preserved-asset-validation`
- `warnings`: human-readable upgrade risks or degraded outcomes
- `checkedAt`

**Validation Rules**:
- `state=current` requires no unresolved drift categories.
- `state=blocked` requires at least one warning explaining why automatic migration is unsafe or unsupported.
- `automaticMigrationAllowed=false` must align with compatibility rules and stored version evidence.

## Entity: MigrationStep

**Purpose**: Defines one ordered, atomic upgrade operation applied to project-local state or runtime definitions.

**Fields**:
- `id`: stable step identifier
- `kind`: `metadata`, `runtime-definition`, `engine-state`, `asset-classification`, `discovery`, `bootstrap`, or `validation`
- `fromVersion`
- `toVersion`
- `required`: whether failure blocks a healthy outcome
- `preconditions`: checks that must pass before execution
- `rollbackStrategy`: `rollback-step`, `quarantine`, or `none`
- `rebuildsAllowed`: whether the step may mark assets as rebuildable

**State Transitions**:
- `pending` → `running` when checkpoint execution begins
- `running` → `completed` when the step commits successfully
- `running` → `quarantined` when the step preserves state but isolates invalid assets
- `running` → `failed` when the step cannot complete or safely quarantine

## Entity: UpgradeCheckpoint

**Purpose**: Persisted execution evidence that allows interrupted upgrades to resume safely.

**Fields**:
- `upgradeId`: unique identifier for one upgrade attempt
- `targetVersion`
- `currentStepId`: currently active step or `null` if idle
- `completedStepIds`: ordered list of committed steps
- `quarantinedStepIds`: steps that ended in degraded-but-preserved state
- `lastAttemptAt`
- `resumeAllowed`: whether a later migrate/repair action may continue from this checkpoint
- `failureReason`: last blocking reason, if any

**Validation Rules**:
- `completedStepIds` must preserve migration order.
- `resumeAllowed=false` requires a blocking reason or manual intervention requirement.
- A checkpoint may not report completion for a step that has no recorded outcome evidence.

## Entity: BackupArtifact

**Purpose**: Represents a backup created before mutation of critical project-local metadata.

**Fields**:
- `path`: original file path
- `backupPath`: backup file path
- `category`: `config`, `runtime-metadata`, `engine-state`, `routing`, `bootstrap`, or `upgrade-metadata`
- `createdAt`
- `restorable`: boolean
- `restoredAt`: timestamp when restore occurred, if any

**Validation Rules**:
- Backup artifacts are mandatory for critical metadata files before their first mutation in a migration run.
- `backupPath` must differ from `path`.
- A restore operation may target only restorable backups.

## Entity: PreservedAssetRecord

**Purpose**: Tracks how a preserved local asset class is treated during upgrade and validation.

**Fields**:
- `assetType`: `notes`, `memory`, `reports`, `runtime-metadata`, `engine-index`, `engine-cache`, or `engine-state`
- `location`
- `compatibility`: `compatible`, `migrate`, `rebuild`, or `blocked`
- `validationMode`: `metadata`, `presence`, `live-check`, or `none`
- `validationResult`: `passed`, `failed`, `skipped`, or `quarantined`
- `repairRequired`: boolean
- `details`: summary of why the asset was preserved, rebuilt, or quarantined

**Validation Rules**:
- `compatible` assets must not be rebuilt automatically.
- `quarantined` assets require `repairRequired=true`.
- Representative asset classes must include at least one `live-check` validation path before full health is reported.

## Entity: EngineUpgradeDecision

**Purpose**: Captures per-engine reconciliation choices during upgrade.

**Fields**:
- `engine`: engine identifier
- `currentImageTag`
- `targetImageTag`
- `configHashChanged`: boolean
- `bootstrapInputChanged`: boolean
- `runtimeAction`: `none`, `recreate-service`, `restart-service`, `rediscover-only`, or `rebootstrap`
- `assetImpact`: summary of which engine-owned indexes/caches are preserved, migrated, or rebuilt

**Relationships**:
- Many `EngineUpgradeDecision` records attach to one `UpgradeStatusReport`.
- Each decision influences `MigrationStep` ordering and `PreservedAssetRecord` outcomes.

## Entity: UpgradeOutcome

**Purpose**: Final result of a migrate, repair, or refresh action.

**Fields**:
- `result`: `success`, `degraded`, `blocked`, or `failed`
- `statusReport`: resulting `UpgradeStatusReport`
- `completedSteps`
- `restoredBackups`: backup artifacts restored during rollback of the active step
- `quarantinedAssets`: subset of `PreservedAssetRecord`
- `nextCommand`: recommended next action such as `status`, `repair`, or `manual`
- `completedAt`

**Validation Rules**:
- `success` requires all required migration steps complete and representative preserved-asset live checks pass.
- `degraded` requires at least one quarantined asset or degraded preserved-state warning.
- `blocked` requires either out-of-window compatibility or an unsafe migration path.