import type {
	EngineUpgradeDecision,
	MimirmeshConfig,
	PreservedAssetRecord,
	ProjectRuntimeVersionRecord,
	RuntimeMigrationKind,
	RuntimeMigrationRollbackStrategy,
	RuntimeUpgradeMetadata,
	UpgradeCheckpoint,
	UpgradeOutcome,
	UpgradeStatusReport,
} from "@mimirmesh/config";
import type { ProjectLogger } from "@mimirmesh/logging";

export type RuntimeMigrationPlanStep = {
	id: string;
	description: string;
	kind: RuntimeMigrationKind;
	fromVersion: number;
	toVersion: number;
	required: boolean;
	rollbackStrategy: RuntimeMigrationRollbackStrategy;
	rebuildsAllowed: boolean;
};

export type RuntimeMigrationPlan = {
	currentVersion: ProjectRuntimeVersionRecord | null;
	targetVersion: ProjectRuntimeVersionRecord;
	automaticMigrationAllowed: boolean;
	steps: RuntimeMigrationPlanStep[];
	resumeFromStepId: string | null;
};

export type MigrationContext = {
	projectRoot: string;
	config: MimirmeshConfig;
	logger?: ProjectLogger;
	upgradeId: string;
	targetVersion: ProjectRuntimeVersionRecord;
	metadata: RuntimeUpgradeMetadata;
	checkpoint: UpgradeCheckpoint | null;
	plan: RuntimeMigrationPlan;
};

export interface RuntimeMigration extends RuntimeMigrationPlanStep {
	run(context: MigrationContext): Promise<void>;
}

export type RuntimeUpgradeExecution = {
	report: UpgradeStatusReport;
	metadata: RuntimeUpgradeMetadata | null;
	checkpoint: UpgradeCheckpoint | null;
	outcome: UpgradeOutcome | null;
	preservedAssets: PreservedAssetRecord[];
	engineDecisions: EngineUpgradeDecision[];
	completedSteps: string[];
};

export type RuntimeUpgradeActionResult = RuntimeUpgradeExecution & {
	ok: boolean;
	action: "status" | "migrate" | "repair" | "doctor";
	message: string;
};
