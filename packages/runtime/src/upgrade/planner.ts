import { loadCheckpoint } from "./checkpoints";
import type { RuntimeMigration, RuntimeMigrationPlan } from "./contracts";
import { initRuntimeMigration } from "./migrations/001-init-runtime";
import { composeLayoutMigration } from "./migrations/002-compose-layout";
import { engineStateMigration } from "./migrations/003-engine-state";
import {
	createTargetVersionRecord,
	detectProjectRuntimeVersion,
	isAutomaticMigrationAllowed,
} from "./versioning";

export const runtimeMigrationRegistry: RuntimeMigration[] = [
	initRuntimeMigration,
	composeLayoutMigration,
	engineStateMigration,
];

export const planRuntimeMigrations = async (projectRoot: string): Promise<RuntimeMigrationPlan> => {
	const currentVersion = await detectProjectRuntimeVersion(projectRoot);
	const targetVersion = createTargetVersionRecord("runtime-upgrade-plan");
	const checkpoint = await loadCheckpoint(projectRoot);
	const automaticMigrationAllowed = isAutomaticMigrationAllowed(currentVersion, targetVersion);
	const steps: RuntimeMigrationPlan["steps"] = [];

	if (currentVersion && automaticMigrationAllowed) {
		let schemaVersion = currentVersion.runtimeSchemaVersion;
		while (schemaVersion < targetVersion.runtimeSchemaVersion) {
			const migration = runtimeMigrationRegistry.find(
				(entry) => entry.fromVersion === schemaVersion,
			);
			if (!migration) {
				break;
			}
			steps.push(migration);
			schemaVersion = migration.toVersion;
		}
	}

	return {
		currentVersion,
		targetVersion,
		automaticMigrationAllowed,
		steps,
		resumeFromStepId:
			checkpoint?.resumeAllowed &&
			checkpoint.targetVersion.runtimeSchemaVersion <= targetVersion.runtimeSchemaVersion
				? (checkpoint.currentStepId ??
					steps.find((step) => !checkpoint.completedStepIds.includes(step.id))?.id ??
					null)
				: null,
	};
};
