export { collectPreservedAssets, quarantineAsset, restoreQuarantinedAsset } from "./assets";
export {
	createBackupManifest,
	defaultBackupTargets,
	restoreBackupArtifact,
	restoreBackupManifest,
} from "./backups";
export {
	completeCheckpointStep,
	createUpgradeCheckpoint,
	failCheckpointStep,
	finishCheckpoint,
	loadCheckpoint,
	quarantineCheckpointStep,
	saveCheckpoint,
	startCheckpointStep,
} from "./checkpoints";
export type {
	MigrationContext,
	RuntimeMigration,
	RuntimeMigrationPlan,
	RuntimeMigrationPlanStep,
	RuntimeUpgradeActionResult,
	RuntimeUpgradeExecution,
} from "./contracts";
export { collectEngineUpgradeDecisions } from "./decisions";
export { createRuntimeUpgradeMetadata, persistRuntimeVersionEvidence } from "./metadata";
export { migrateRuntime } from "./migrate";
export {
	planRuntimeMigrations,
	runtimeMigrationRegistry,
} from "./planner";
export { reconcileRuntime } from "./reconcile";
export { repairRuntime } from "./repair";
export { classifyUpgradeStatus, recommendedUpgradeCommand } from "./status";
export type * from "./types";
export { validatePreservedAssets } from "./validate";
export {
	CURRENT_ENGINE_DEFINITION_VERSION,
	CURRENT_RUNTIME_SCHEMA_VERSION,
	CURRENT_RUNTIME_VERSION,
	CURRENT_STATE_COMPATIBILITY_VERSION,
	collectVersionDrift,
	createTargetVersionRecord,
	detectProjectRuntimeVersion,
	isAutomaticMigrationAllowed,
	MIN_AUTOMATIC_RUNTIME_SCHEMA_VERSION,
	reportVersionDelta,
	requiresMigration,
} from "./versioning";
