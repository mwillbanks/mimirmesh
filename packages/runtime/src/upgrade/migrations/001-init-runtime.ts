import { loadUpgradeMetadata, persistUpgradeMetadata, persistVersionRecord } from "../../state/io";
import type { RuntimeMigration } from "../contracts";
import { createTargetVersionRecord } from "../versioning";

export const initRuntimeMigration: RuntimeMigration = {
	id: "001-init-runtime",
	description: "Introduce explicit runtime version evidence and upgrade metadata.",
	kind: "metadata",
	fromVersion: 1,
	toVersion: 2,
	required: true,
	rollbackStrategy: "rollback-step",
	rebuildsAllowed: false,
	run: async (context) => {
		const version = createTargetVersionRecord(`migration:${initRuntimeMigration.id}`, {
			schemaVersion: 2,
			runtimeSchemaVersion: 2,
			engineDefinitionVersion: "2",
		});
		const existing = await loadUpgradeMetadata(context.projectRoot);
		await persistVersionRecord(context.projectRoot, version);
		await persistUpgradeMetadata(context.projectRoot, {
			version,
			statusReport: existing?.statusReport ?? null,
			lastOutcome: existing?.lastOutcome ?? null,
			preservedAssets: existing?.preservedAssets ?? [],
			engineDecisions: existing?.engineDecisions ?? [],
			updatedAt: new Date().toISOString(),
			lastValidatedAt: existing?.lastValidatedAt ?? null,
		});
	},
};
