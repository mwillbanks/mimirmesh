import type {
	EngineUpgradeDecision,
	PreservedAssetRecord,
	RuntimeUpgradeMetadata,
	UpgradeOutcome,
	UpgradeStatusReport,
} from "@mimirmesh/config";

import {
	loadUpgradeMetadata,
	loadVersionRecord,
	persistUpgradeMetadata,
	persistVersionRecord,
} from "../state/io";
import { createTargetVersionRecord } from "./versioning";

type MetadataUpdate = {
	generatedBy: string;
	statusReport?: UpgradeStatusReport | null;
	lastOutcome?: UpgradeOutcome | null;
	preservedAssets?: PreservedAssetRecord[];
	engineDecisions?: EngineUpgradeDecision[];
	lastValidatedAt?: string | null;
};

export const createRuntimeUpgradeMetadata = (update: MetadataUpdate): RuntimeUpgradeMetadata => {
	const version = createTargetVersionRecord(update.generatedBy);
	return {
		version,
		statusReport: update.statusReport ?? null,
		lastOutcome: update.lastOutcome ?? null,
		preservedAssets: update.preservedAssets ?? [],
		engineDecisions: update.engineDecisions ?? [],
		updatedAt: new Date().toISOString(),
		lastValidatedAt: update.lastValidatedAt ?? null,
	};
};

export const persistRuntimeVersionEvidence = async (
	projectRoot: string,
	update: MetadataUpdate,
): Promise<RuntimeUpgradeMetadata> => {
	const previousVersion = await loadVersionRecord(projectRoot);
	const previousMetadata = await loadUpgradeMetadata(projectRoot);
	const version = {
		...createTargetVersionRecord(update.generatedBy),
		lastUpgrade:
			update.lastOutcome && update.lastOutcome.result !== "blocked"
				? update.lastOutcome.completedAt
				: (previousVersion?.lastUpgrade ?? null),
	};

	const metadata: RuntimeUpgradeMetadata = {
		version,
		statusReport: update.statusReport ?? previousMetadata?.statusReport ?? null,
		lastOutcome: update.lastOutcome ?? previousMetadata?.lastOutcome ?? null,
		preservedAssets: update.preservedAssets ?? previousMetadata?.preservedAssets ?? [],
		engineDecisions: update.engineDecisions ?? previousMetadata?.engineDecisions ?? [],
		updatedAt: new Date().toISOString(),
		lastValidatedAt:
			update.lastValidatedAt === undefined
				? (previousMetadata?.lastValidatedAt ?? null)
				: update.lastValidatedAt,
	};

	await persistVersionRecord(projectRoot, version);
	await persistUpgradeMetadata(projectRoot, metadata);
	return metadata;
};
