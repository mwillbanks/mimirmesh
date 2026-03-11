import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";

import type { MimirmeshConfig } from "@mimirmesh/config";
import type { ProjectLogger } from "@mimirmesh/logging";
import { restoreQuarantinedAsset } from "./assets";
import { restoreBackupManifest } from "./backups";
import { loadCheckpoint } from "./checkpoints";
import { persistRuntimeVersionEvidence } from "./metadata";
import { migrateRuntime } from "./migrate";
import { reconcileRuntime } from "./reconcile";
import { classifyUpgradeStatus, recommendedUpgradeCommand } from "./status";
import { validatePreservedAssets } from "./validate";

const rebuildSqliteAsset = async (location: string): Promise<void> => {
	await mkdir(location.endsWith(".db") ? location.replace(/\/[^/]+$/, "") : location, {
		recursive: true,
	});
	const database = new Database(location, { create: true });
	try {
		database.exec("CREATE TABLE IF NOT EXISTS repaired (id INTEGER PRIMARY KEY, note TEXT)");
	} finally {
		database.close();
	}
};

export const repairRuntime = async (
	projectRoot: string,
	config: MimirmeshConfig,
	logger?: ProjectLogger,
) => {
	const checkpoint = await loadCheckpoint(projectRoot);
	if (
		checkpoint?.resumeAllowed &&
		(checkpoint.currentStepId || checkpoint.completedStepIds.length > 0)
	) {
		await restoreBackupManifest({ projectRoot });
		return migrateRuntime(projectRoot, config, logger);
	}

	const status = await classifyUpgradeStatus(projectRoot, config);
	if (status.report.state === "blocked") {
		const metadata = await persistRuntimeVersionEvidence(projectRoot, {
			generatedBy: "runtime-upgrade-repair",
			statusReport: status.report,
			preservedAssets: status.preservedAssets,
			engineDecisions: status.engineDecisions,
			lastOutcome: {
				result: "blocked",
				statusReport: status.report,
				completedSteps: checkpoint?.completedStepIds ?? [],
				restoredBackups: [],
				quarantinedAssets: status.preservedAssets.filter(
					(asset) => asset.validationResult === "quarantined",
				),
				nextCommand: recommendedUpgradeCommand(status.report),
				completedAt: new Date().toISOString(),
				resumedFromCheckpoint: false,
			},
		});
		return {
			ok: false,
			action: "repair" as const,
			message: status.report.warnings.join(" ") || "Runtime repair is blocked.",
			report: status.report,
			metadata,
			checkpoint,
			outcome: metadata.lastOutcome,
			preservedAssets: status.preservedAssets,
			engineDecisions: status.engineDecisions,
			completedSteps: checkpoint?.completedStepIds ?? [],
		};
	}

	let repairedAssets = await Promise.all(
		status.preservedAssets.map(async (asset) => {
			let next = asset;
			if (asset.quarantinePath) {
				next = await restoreQuarantinedAsset(asset);
			}
			if (next.assetType === "engine-index" && next.validationResult !== "passed") {
				await rebuildSqliteAsset(next.location);
			}
			return next;
		}),
	);

	if (
		repairedAssets.some(
			(asset) =>
				asset.assetType === "runtime-metadata" ||
				asset.assetType === "engine-state" ||
				asset.assetType === "compose-runtime",
		)
	) {
		await reconcileRuntime(projectRoot, config, logger);
	}

	const validation = await validatePreservedAssets({
		projectRoot,
		assets: repairedAssets,
		quarantineInvalidAssets: false,
	});
	repairedAssets = validation.assets;
	const finalStatus = await classifyUpgradeStatus(projectRoot, config);
	const result =
		validation.assets.some((asset) => asset.validationResult === "failed") ||
		finalStatus.report.state === "degraded"
			? "degraded"
			: "success";
	const metadata = await persistRuntimeVersionEvidence(projectRoot, {
		generatedBy: "runtime-upgrade-repair",
		statusReport: finalStatus.report,
		preservedAssets: repairedAssets,
		engineDecisions: finalStatus.engineDecisions,
		lastValidatedAt: new Date().toISOString(),
		lastOutcome: {
			result,
			statusReport: finalStatus.report,
			completedSteps: checkpoint?.completedStepIds ?? [],
			restoredBackups: [],
			quarantinedAssets: repairedAssets.filter((asset) => asset.validationResult === "quarantined"),
			nextCommand: recommendedUpgradeCommand(finalStatus.report),
			completedAt: new Date().toISOString(),
			resumedFromCheckpoint: false,
		},
	});

	return {
		ok: result === "success" || result === "degraded",
		action: "repair" as const,
		message:
			result === "success"
				? "Runtime repair completed."
				: "Runtime repair completed with remaining degraded assets.",
		report: finalStatus.report,
		metadata,
		checkpoint,
		outcome: metadata.lastOutcome,
		preservedAssets: repairedAssets,
		engineDecisions: finalStatus.engineDecisions,
		completedSteps: checkpoint?.completedStepIds ?? [],
	};
};
