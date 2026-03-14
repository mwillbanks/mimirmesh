import type {
	MimirmeshConfig,
	PreservedAssetRecord,
	RuntimeUpgradeDriftCategory,
	UpgradeStatusReport,
} from "@mimirmesh/config";
import { loadUpgradeMetadata } from "../state/io";
import { collectPreservedAssets } from "./assets";
import { loadCheckpoint } from "./checkpoints";
import { collectEngineUpgradeDecisions } from "./decisions";
import {
	collectVersionDrift,
	createTargetVersionRecord,
	detectProjectRuntimeVersion,
	isAutomaticMigrationAllowed,
	requiresMigration,
} from "./versioning";

const unique = <T>(items: T[]): T[] => [...new Set(items)];

const preservedAssetWarnings = (assets: PreservedAssetRecord[]): string[] =>
	assets
		.filter(
			(asset) => asset.validationResult === "failed" || asset.validationResult === "quarantined",
		)
		.map((asset) =>
			asset.quarantinePath
				? `${asset.assetType} quarantined at ${asset.quarantinePath}`
				: `${asset.assetType} requires repair`,
		);

export const classifyUpgradeStatus = async (
	projectRoot: string,
	config: MimirmeshConfig,
): Promise<{
	report: UpgradeStatusReport;
	preservedAssets: PreservedAssetRecord[];
	engineDecisions: Awaited<ReturnType<typeof collectEngineUpgradeDecisions>>;
}> => {
	const currentVersion = await detectProjectRuntimeVersion(projectRoot);
	const targetVersion = createTargetVersionRecord("runtime-upgrade-status");
	const automaticMigrationAllowed = isAutomaticMigrationAllowed(currentVersion, targetVersion);
	const checkpoint = await loadCheckpoint(projectRoot);
	const metadata = await loadUpgradeMetadata(projectRoot);
	const preservedAssets =
		metadata?.preservedAssets.length &&
		metadata.version.runtimeSchemaVersion === targetVersion.runtimeSchemaVersion
			? metadata.preservedAssets
			: await collectPreservedAssets(projectRoot, currentVersion);
	const engineDecisions = await collectEngineUpgradeDecisions(projectRoot, config);

	const driftCategories = new Set<RuntimeUpgradeDriftCategory>(
		collectVersionDrift(currentVersion, targetVersion),
	);
	if (engineDecisions.some((decision) => decision.runtimeAction === "recreate-service")) {
		driftCategories.add("compose-definition");
		driftCategories.add("engine-image");
	}
	if (engineDecisions.some((decision) => decision.runtimeAction === "rebootstrap")) {
		driftCategories.add("bootstrap-input");
	}
	if (
		preservedAssets.some(
			(asset) => asset.validationResult === "failed" || asset.validationResult === "quarantined",
		)
	) {
		driftCategories.add("preserved-asset-validation");
	}
	if (checkpoint?.resumeAllowed && (checkpoint.currentStepId || checkpoint.failureReason)) {
		driftCategories.add("checkpoint-resume");
	}

	const warnings = unique([
		...(metadata?.lastOutcome?.result === "blocked" && metadata.lastOutcome.nextCommand
			? [
					`Previous automatic migration was blocked. Next step: ${metadata.lastOutcome.nextCommand}.`,
				]
			: []),
		...(checkpoint?.failureReason ? [checkpoint.failureReason] : []),
		...preservedAssetWarnings(preservedAssets),
	]);

	let state: UpgradeStatusReport["state"] = "current";
	let requiredActions: UpgradeStatusReport["requiredActions"] = ["none"];

	if (!currentVersion) {
		state = "blocked";
		requiredActions = ["manual-intervention"];
		warnings.push(
			"Project runtime version evidence is missing and legacy state could not be inferred.",
		);
	} else if (
		preservedAssets.some((asset) => asset.validationResult === "quarantined") ||
		metadata?.lastOutcome?.result === "degraded"
	) {
		state = "degraded";
		requiredActions = ["repair-state"];
	} else if (
		checkpoint?.resumeAllowed &&
		(checkpoint.currentStepId || checkpoint.completedStepIds.length > 0)
	) {
		state = automaticMigrationAllowed ? "repairable" : "blocked";
		requiredActions = [automaticMigrationAllowed ? "repair-state" : "manual-intervention"];
	} else if (!automaticMigrationAllowed) {
		state = "blocked";
		requiredActions = ["manual-intervention"];
		if (currentVersion.runtimeSchemaVersion > targetVersion.runtimeSchemaVersion) {
			warnings.push("Stored project runtime is newer than this CLI.");
		} else {
			warnings.push("Stored project runtime is outside the supported automatic migration window.");
		}
	} else if (requiresMigration(currentVersion, targetVersion) || driftCategories.size > 0) {
		state = "outdated";
		requiredActions = [
			requiresMigration(currentVersion, targetVersion) ? "migrate-state" : "restart-runtime",
		];
	}

	return {
		report: {
			state,
			currentVersion,
			targetVersion,
			automaticMigrationAllowed,
			requiredActions,
			driftCategories: [...driftCategories],
			warnings,
			checkedAt: new Date().toISOString(),
		},
		preservedAssets,
		engineDecisions,
	};
};

export const recommendedUpgradeCommand = (report: UpgradeStatusReport): string | null => {
	switch (report.state) {
		case "current":
			return "mimirmesh runtime upgrade status";
		case "outdated":
			return report.requiredActions.includes("migrate-state")
				? "mimirmesh runtime upgrade migrate"
				: "mimirmesh runtime restart --non-interactive";
		case "repairable":
		case "degraded":
			return "mimirmesh runtime upgrade repair";
		case "blocked":
			return "manual";
	}
};
