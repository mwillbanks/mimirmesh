import { Database } from "bun:sqlite";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createDefaultConfig, writeConfig } from "@mimirmesh/config";
import {
	createRuntimeUpgradeMetadata,
	createTargetVersionRecord,
	createUpgradeCheckpoint,
	ensureProjectLayout,
	generateRuntimeFiles,
	persistUpgradeCheckpoint,
	persistUpgradeMetadata,
	persistVersionRecord,
} from "@mimirmesh/runtime";

import { createFixtureCopy } from "./index";

export type RuntimeUpgradeFixtureState =
	| "current"
	| "outdated"
	| "blocked"
	| "repairable"
	| "degraded"
	| "legacy";

const requiredReports = [
	"project-summary.md",
	"architecture.md",
	"deployment.md",
	"runtime-health.md",
	"speckit-status.md",
];

const seedReports = async (projectRoot: string): Promise<void> => {
	for (const report of requiredReports) {
		await writeFile(
			join(projectRoot, ".mimirmesh", "reports", report),
			`# ${report}\n\nFixture report.\n`,
			"utf8",
		);
	}
};

const seedNotes = async (projectRoot: string): Promise<void> => {
	const notesDir = join(projectRoot, ".mimirmesh", "memory", "notes");
	await mkdir(notesDir, { recursive: true });
	await writeFile(join(notesDir, "fixture-note.md"), "# Fixture Note\n\nRetained note.\n", "utf8");
};

const seedSrclightIndex = async (projectRoot: string): Promise<void> => {
	const indexPath = join(projectRoot, ".srclight", "index.db");
	await mkdir(join(projectRoot, ".srclight"), { recursive: true });
	const database = new Database(indexPath, { create: true });
	try {
		database.exec(
			"CREATE TABLE IF NOT EXISTS symbols (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO symbols (name) VALUES ('fixture');",
		);
	} finally {
		database.close();
	}
};

export const createRuntimeUpgradeFixture = async (
	state: RuntimeUpgradeFixtureState,
): Promise<{ repo: string; config: ReturnType<typeof createDefaultConfig> }> => {
	const repo = await createFixtureCopy("single-ts", { initializeGit: true });
	const config = createDefaultConfig(repo);
	await writeConfig(repo, config);
	await ensureProjectLayout(repo);
	await generateRuntimeFiles(repo, config);
	await seedReports(repo);
	await seedNotes(repo);
	await seedSrclightIndex(repo);

	const outdatedVersion = createTargetVersionRecord("fixture-outdated", {
		runtimeVersion: "0.9.0",
		cliVersion: "0.9.0",
		schemaVersion: 1,
		runtimeSchemaVersion: 1,
		engineDefinitionVersion: "1",
		lastUpgrade: null,
	});
	const currentVersion = createTargetVersionRecord("fixture-current");

	if (state === "legacy") {
		await rm(join(repo, ".mimirmesh", "runtime", "version.json"), { force: true });
		await rm(join(repo, ".mimirmesh", "runtime", "upgrade-metadata.json"), { force: true });
		return { repo, config };
	}

	if (state === "current") {
		await persistVersionRecord(repo, currentVersion);
		await persistUpgradeMetadata(
			repo,
			createRuntimeUpgradeMetadata({
				generatedBy: "fixture-current",
			}),
		);
		return { repo, config };
	}

	if (state === "outdated") {
		await persistVersionRecord(repo, outdatedVersion);
		await persistUpgradeMetadata(
			repo,
			createRuntimeUpgradeMetadata({
				generatedBy: "fixture-outdated",
			}),
		);
		return { repo, config };
	}

	if (state === "blocked") {
		const blockedVersion = createTargetVersionRecord("fixture-blocked", {
			runtimeVersion: "0.1.0",
			cliVersion: "0.1.0",
			schemaVersion: 0,
			runtimeSchemaVersion: 0,
			engineDefinitionVersion: "0",
			stateCompatibilityVersion: "unsupported-window",
			lastUpgrade: null,
		});
		await persistVersionRecord(repo, blockedVersion);
		await persistUpgradeMetadata(
			repo,
			createRuntimeUpgradeMetadata({
				generatedBy: "fixture-blocked",
			}),
		);
		return { repo, config };
	}

	if (state === "repairable") {
		await persistVersionRecord(repo, outdatedVersion);
		await persistUpgradeMetadata(
			repo,
			createRuntimeUpgradeMetadata({
				generatedBy: "fixture-repairable",
			}),
		);
		await persistUpgradeCheckpoint(repo, {
			...createUpgradeCheckpoint({
				upgradeId: "fixture-repairable",
				targetVersion: currentVersion,
			}),
			currentStepId: "002-compose-layout",
			completedStepIds: ["001-init-runtime"],
			resumeAllowed: true,
			failureReason: "compose layout upgrade interrupted",
		});
		return { repo, config };
	}

	await persistVersionRecord(repo, currentVersion);
	await persistUpgradeMetadata(repo, {
		...createRuntimeUpgradeMetadata({
			generatedBy: "fixture-degraded",
		}),
		preservedAssets: [
			{
				assetType: "engine-index",
				location: join(repo, ".srclight", "index.db"),
				compatibility: "compatible",
				validationMode: "live-check",
				validationResult: "quarantined",
				repairRequired: true,
				details: "Fixture degraded index requires repair.",
				quarantinePath: join(repo, ".mimirmesh", "runtime", "quarantine", "index.db"),
				lastValidatedAt: new Date().toISOString(),
			},
		],
		lastOutcome: {
			result: "degraded",
			statusReport: {
				state: "degraded",
				currentVersion,
				targetVersion: currentVersion,
				automaticMigrationAllowed: true,
				requiredActions: ["repair-state"],
				driftCategories: ["preserved-asset-validation"],
				warnings: ["Fixture degraded asset requires repair."],
				checkedAt: new Date().toISOString(),
			},
			completedSteps: ["001-init-runtime", "002-compose-layout", "003-engine-state"],
			restoredBackups: [],
			quarantinedAssets: [],
			nextCommand: "mimirmesh runtime upgrade repair",
			completedAt: new Date().toISOString(),
			resumedFromCheckpoint: false,
		},
	});
	return { repo, config };
};
