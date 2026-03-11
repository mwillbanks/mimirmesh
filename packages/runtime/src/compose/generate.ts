import type { MimirmeshConfig } from "@mimirmesh/config";
import { translateAllEngineConfigs } from "@mimirmesh/mcp-adapters";
import { materializeRuntimeImages } from "../images/materialize";
import {
	collectSrclightRepoLocalEvidence,
	hashValue,
	persistBackupManifest,
	persistBootstrapState,
	persistConnection,
	persistEngineState,
	persistHealth,
	persistRoutingTable,
	persistUpgradeCheckpoint,
	persistUpgradeMetadata,
	persistVersionRecord,
	writeComposeFile,
} from "../state/io";
import { backupSnapshotRoot } from "../state/paths";
import type { RuntimeConnection, RuntimeHealth } from "../types";
import { createUpgradeCheckpoint } from "../upgrade/checkpoints";
import { createRuntimeUpgradeMetadata } from "../upgrade/metadata";
import { createTargetVersionRecord } from "../upgrade/versioning";
import { renderCompose } from "./render";

export const generateRuntimeFiles = async (
	projectRoot: string,
	config: MimirmeshConfig,
): Promise<{ connection: RuntimeConnection; composeFile: string }> => {
	await materializeRuntimeImages(projectRoot);
	const srclightEvidence = await collectSrclightRepoLocalEvidence(projectRoot);
	const compose = renderCompose(projectRoot, config);
	await writeComposeFile(projectRoot, compose);

	const translated = translateAllEngineConfigs(projectRoot, config);

	const connection: RuntimeConnection = {
		projectName: config.runtime.projectName,
		composeFile: config.runtime.composeFile,
		updatedAt: new Date().toISOString(),
		startedAt: null,
		mounts: {
			repository: projectRoot,
			mimirmesh: `${projectRoot}/.mimirmesh`,
		},
		services: [
			"mm-postgres",
			...translated
				.filter((engine) => config.engines[engine.contract.id].enabled)
				.map((engine) => engine.contract.serviceName),
		],
		bridgePorts: {},
	};

	const health: RuntimeHealth = {
		timestamp: new Date().toISOString(),
		state: "failed",
		dockerInstalled: false,
		dockerDaemonRunning: false,
		composeAvailable: false,
		degraded: true,
		reasons: ["Runtime has not been started yet."],
		services: [],
		bridges: [],
	};

	await persistConnection(projectRoot, connection);
	await persistHealth(projectRoot, health);
	await persistRoutingTable(projectRoot, {
		generatedAt: new Date().toISOString(),
		passthrough: [],
		unified: [],
	});
	await persistBootstrapState(projectRoot, {
		updatedAt: new Date().toISOString(),
		engines: translated.map((engine) => ({
			engine: engine.contract.id,
			required: Boolean(config.engines[engine.contract.id].required),
			mode: "none",
			completed: false,
			bootstrapInputHash: hashValue({ pending: true }),
			projectRootHash: hashValue(projectRoot),
			lastStartedAt: null,
			lastCompletedAt: null,
			failureReason: null,
			retryCount: 0,
		})),
	});

	for (const engine of translated) {
		const enabled = Boolean(config.engines[engine.contract.id].enabled);
		const bootstrapMode =
			engine.contract.id === "srclight"
				? "command"
				: engine.contract.id === "codebase-memory-mcp"
					? "tool"
					: "none";
		await persistEngineState(projectRoot, {
			engine: engine.contract.id,
			enabled,
			required: Boolean(config.engines[engine.contract.id].required),
			namespace: engine.contract.namespace,
			serviceName: engine.contract.serviceName,
			imageTag: engine.contract.imageTag,
			configHash: hashValue(engine.contract.env),
			discoveredTools: [],
			health: {
				state: enabled ? "unhealthy" : "unknown",
				message: enabled ? "Engine not started" : "Engine disabled",
				checkedAt: new Date().toISOString(),
			},
			bridge: {
				url: "",
				transport: engine.contract.bridgeTransport,
				healthy: false,
				checkedAt: new Date().toISOString(),
				lastError: enabled ? "Bridge not started" : undefined,
			},
			lastStartupAt: null,
			lastBootstrapAt: null,
			lastBootstrapResult: enabled ? "pending" : "skipped",
			degradedReason: enabled ? "Not started" : undefined,
			capabilityWarnings: [],
			runtimeEvidence:
				engine.contract.id === "srclight"
					? {
							bootstrapMode,
							...srclightEvidence,
						}
					: {
							bootstrapMode,
						},
		});
	}

	const version = createTargetVersionRecord("generate-runtime-files");
	await persistVersionRecord(projectRoot, version);
	await persistUpgradeMetadata(
		projectRoot,
		createRuntimeUpgradeMetadata({
			generatedBy: "generate-runtime-files",
		}),
	);
	await persistUpgradeCheckpoint(projectRoot, {
		...createUpgradeCheckpoint({
			upgradeId: "initial-runtime-state",
			targetVersion: version,
		}),
		resumeAllowed: false,
	});
	await persistBackupManifest(projectRoot, {
		upgradeId: "initial-runtime-state",
		root: backupSnapshotRoot(projectRoot, "initial-runtime-state"),
		createdAt: new Date().toISOString(),
		artifacts: [],
	});

	return {
		connection,
		composeFile: config.runtime.composeFile,
	};
};
