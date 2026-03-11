import { generateRuntimeFiles } from "../../compose/generate";
import { loadUpgradeMetadata, persistUpgradeMetadata, persistVersionRecord } from "../../state/io";
import type { RuntimeMigration } from "../contracts";
import { createTargetVersionRecord } from "../versioning";

export const composeLayoutMigration: RuntimeMigration = {
	id: "002-compose-layout",
	description: "Regenerate runtime compose and metadata layout in place.",
	kind: "runtime-definition",
	fromVersion: 2,
	toVersion: 3,
	required: true,
	rollbackStrategy: "rollback-step",
	rebuildsAllowed: false,
	run: async (context) => {
		await generateRuntimeFiles(context.projectRoot, context.config);
		const version = createTargetVersionRecord(`migration:${composeLayoutMigration.id}`, {
			schemaVersion: 3,
			runtimeSchemaVersion: 3,
			engineDefinitionVersion: "3",
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
