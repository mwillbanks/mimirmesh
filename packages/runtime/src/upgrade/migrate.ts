import type { MimirmeshConfig } from "@mimirmesh/config";
import type { ProjectLogger } from "@mimirmesh/logging";

import { createBackupManifest, restoreBackupManifest } from "./backups";
import {
	completeCheckpointStep,
	createUpgradeCheckpoint,
	failCheckpointStep,
	finishCheckpoint,
	loadCheckpoint,
	quarantineCheckpointStep,
	saveCheckpoint,
	startCheckpointStep,
} from "./checkpoints";
import type { RuntimeMigration, RuntimeUpgradeActionResult } from "./contracts";
import { persistRuntimeVersionEvidence } from "./metadata";
import { planRuntimeMigrations, runtimeMigrationRegistry } from "./planner";
import { reconcileRuntime } from "./reconcile";
import { classifyUpgradeStatus, recommendedUpgradeCommand } from "./status";
import { validatePreservedAssets } from "./validate";

const timestampId = (): string => new Date().toISOString().replaceAll(":", "-");

const registryById = new Map(
	runtimeMigrationRegistry.map((migration) => [migration.id, migration]),
);

const syntheticSteps = (runtimeMigrations: RuntimeMigration[]): RuntimeMigration[] => [
	...runtimeMigrations,
	{
		id: "reconcile-runtime",
		description: "Reconcile generated runtime definitions and impacted services.",
		kind: "runtime-definition",
		fromVersion: 0,
		toVersion: 0,
		required: true,
		rollbackStrategy: "rollback-step",
		rebuildsAllowed: false,
		run: async () => {},
	},
	{
		id: "validate-preserved-assets",
		description: "Validate preserved runtime metadata, reports, notes, and indexes.",
		kind: "validation",
		fromVersion: 0,
		toVersion: 0,
		required: false,
		rollbackStrategy: "quarantine",
		rebuildsAllowed: true,
		run: async () => {},
	},
];

export const migrateRuntime = async (
	projectRoot: string,
	config: MimirmeshConfig,
	logger?: ProjectLogger,
): Promise<RuntimeUpgradeActionResult> => {
	const initialStatus = await classifyUpgradeStatus(projectRoot, config);
	const existingCheckpoint = await loadCheckpoint(projectRoot);
	if (initialStatus.report.state === "blocked") {
		const metadata = await persistRuntimeVersionEvidence(projectRoot, {
			generatedBy: "runtime-upgrade-migrate",
			statusReport: initialStatus.report,
			preservedAssets: initialStatus.preservedAssets,
			engineDecisions: initialStatus.engineDecisions,
			lastOutcome: {
				result: "blocked",
				statusReport: initialStatus.report,
				completedSteps: existingCheckpoint?.completedStepIds ?? [],
				restoredBackups: [],
				quarantinedAssets: initialStatus.preservedAssets.filter(
					(asset) => asset.validationResult === "quarantined",
				),
				nextCommand: recommendedUpgradeCommand(initialStatus.report),
				completedAt: new Date().toISOString(),
				resumedFromCheckpoint: false,
			},
		});
		return {
			ok: false,
			action: "migrate",
			message: initialStatus.report.warnings.join(" ") || "Automatic migration is blocked.",
			report: initialStatus.report,
			metadata,
			checkpoint: existingCheckpoint,
			outcome: metadata.lastOutcome,
			preservedAssets: initialStatus.preservedAssets,
			engineDecisions: initialStatus.engineDecisions,
			completedSteps: existingCheckpoint?.completedStepIds ?? [],
		};
	}

	const plan = await planRuntimeMigrations(projectRoot);
	const upgradeId = existingCheckpoint?.resumeAllowed
		? existingCheckpoint.upgradeId
		: timestampId();
	let checkpoint =
		existingCheckpoint?.resumeAllowed &&
		existingCheckpoint.targetVersion.runtimeSchemaVersion <= plan.targetVersion.runtimeSchemaVersion
			? existingCheckpoint
			: createUpgradeCheckpoint({
					upgradeId,
					targetVersion: plan.targetVersion,
				});
	checkpoint = await saveCheckpoint(projectRoot, checkpoint);

	const migrations = plan.steps
		.map((step) => registryById.get(step.id))
		.filter((step): step is RuntimeMigration => Boolean(step));
	const steps = syntheticSteps(migrations);
	const restoredBackups: NonNullable<RuntimeUpgradeActionResult["outcome"]>["restoredBackups"] = [];
	let preservedAssets = initialStatus.preservedAssets;
	let engineDecisions = initialStatus.engineDecisions;
	const resumedFromCheckpoint = Boolean(existingCheckpoint?.resumeAllowed);

	for (const step of steps) {
		if (checkpoint.completedStepIds.includes(step.id)) {
			continue;
		}

		checkpoint = await startCheckpointStep({
			projectRoot,
			checkpoint,
			stepId: step.id,
		});
		await createBackupManifest({
			projectRoot,
			upgradeId: `${upgradeId}-${step.id}`,
		});

		try {
			if (step.id === "reconcile-runtime") {
				const reconciled = await reconcileRuntime(projectRoot, config, logger);
				engineDecisions = reconciled.engineDecisions;
			} else if (step.id === "validate-preserved-assets") {
				const validation = await validatePreservedAssets({
					projectRoot,
					assets: preservedAssets,
					quarantineInvalidAssets: true,
				});
				preservedAssets = validation.assets;
				if (validation.quarantinedAssets.length > 0) {
					checkpoint = await quarantineCheckpointStep({
						projectRoot,
						checkpoint,
						stepId: step.id,
						failureReason: validation.warnings.join("; "),
					});
					continue;
				}
			} else {
				await step.run({
					projectRoot,
					config,
					logger,
					upgradeId,
					targetVersion: plan.targetVersion,
					metadata: await persistRuntimeVersionEvidence(projectRoot, {
						generatedBy: `runtime-upgrade-step:${step.id}`,
						statusReport: initialStatus.report,
						preservedAssets,
						engineDecisions,
					}),
					checkpoint,
					plan,
				});
			}
			checkpoint = await completeCheckpointStep({
				projectRoot,
				checkpoint,
				stepId: step.id,
			});
		} catch (error) {
			const failureReason = error instanceof Error ? error.message : String(error);
			const restored = await restoreBackupManifest({ projectRoot });
			restoredBackups.push(...restored);
			checkpoint = await failCheckpointStep({
				projectRoot,
				checkpoint,
				stepId: step.id,
				failureReason,
				resumeAllowed: true,
			});

			const report = await classifyUpgradeStatus(projectRoot, config);
			const metadata = await persistRuntimeVersionEvidence(projectRoot, {
				generatedBy: "runtime-upgrade-migrate",
				statusReport: report.report,
				preservedAssets,
				engineDecisions,
				lastOutcome: {
					result: "failed",
					statusReport: report.report,
					completedSteps: checkpoint.completedStepIds,
					restoredBackups,
					quarantinedAssets: preservedAssets.filter(
						(asset) => asset.validationResult === "quarantined",
					),
					nextCommand: recommendedUpgradeCommand(report.report),
					completedAt: new Date().toISOString(),
					resumedFromCheckpoint,
				},
			});
			return {
				ok: false,
				action: "migrate",
				message: failureReason,
				report: report.report,
				metadata,
				checkpoint,
				outcome: metadata.lastOutcome,
				preservedAssets,
				engineDecisions,
				completedSteps: checkpoint.completedStepIds,
			};
		}
	}

	checkpoint = await finishCheckpoint({ projectRoot, checkpoint });
	const finalStatus = await classifyUpgradeStatus(projectRoot, config);
	const outcomeResult =
		finalStatus.report.state === "degraded"
			? "degraded"
			: finalStatus.report.state === "blocked"
				? "blocked"
				: "success";
	const metadata = await persistRuntimeVersionEvidence(projectRoot, {
		generatedBy: "runtime-upgrade-migrate",
		statusReport: finalStatus.report,
		preservedAssets,
		engineDecisions,
		lastValidatedAt: new Date().toISOString(),
		lastOutcome: {
			result: outcomeResult,
			statusReport: finalStatus.report,
			completedSteps: checkpoint.completedStepIds,
			restoredBackups,
			quarantinedAssets: preservedAssets.filter(
				(asset) => asset.validationResult === "quarantined",
			),
			nextCommand: recommendedUpgradeCommand(finalStatus.report),
			completedAt: new Date().toISOString(),
			resumedFromCheckpoint,
		},
	});

	return {
		ok: outcomeResult === "success" || outcomeResult === "degraded",
		action: "migrate",
		message:
			outcomeResult === "success"
				? "Project runtime upgraded in place."
				: outcomeResult === "degraded"
					? "Project runtime upgraded with quarantined preserved assets."
					: "Project runtime upgrade is blocked.",
		report: finalStatus.report,
		metadata,
		checkpoint,
		outcome: metadata.lastOutcome,
		preservedAssets,
		engineDecisions,
		completedSteps: checkpoint.completedStepIds,
	};
};
