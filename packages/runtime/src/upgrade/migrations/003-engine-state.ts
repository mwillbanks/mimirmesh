import { allEngineAdapters } from "@mimirmesh/mcp-adapters";

import {
	loadEngineState,
	loadUpgradeMetadata,
	persistEngineState,
	persistUpgradeMetadata,
	persistVersionRecord,
} from "../../state/io";
import type { RuntimeMigration } from "../contracts";
import { createTargetVersionRecord } from "../versioning";

export const engineStateMigration: RuntimeMigration = {
	id: "003-engine-state",
	description: "Normalize engine runtime state evidence for upgrade-aware reconciliation.",
	kind: "engine-state",
	fromVersion: 3,
	toVersion: 4,
	required: true,
	rollbackStrategy: "rollback-step",
	rebuildsAllowed: false,
	run: async (context) => {
		for (const adapter of allEngineAdapters) {
			const current = await loadEngineState(context.projectRoot, adapter.id);
			if (!current) {
				continue;
			}
			await persistEngineState(context.projectRoot, {
				...current,
				capabilityWarnings: current.capabilityWarnings ?? [],
				runtimeEvidence: current.runtimeEvidence ?? {
					bootstrapMode: adapter.bootstrap?.mode ?? "none",
				},
			});
		}

		const version = createTargetVersionRecord(`migration:${engineStateMigration.id}`);
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
