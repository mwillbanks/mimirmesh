import { rm } from "node:fs/promises";

import type { MimirmeshConfig } from "@mimirmesh/config";
import {
	allEngineAdapters,
	type RuntimeAdapterContext,
	translateAllEngineConfigs,
} from "@mimirmesh/mcp-adapters";
import { materializeRuntimeImages } from "../images/materialize";
import { resolveRuntimeAdapterContext } from "../services/gpu-policy";
import {
	collectSrclightRepoLocalEvidence,
	hashValue,
	loadBootstrapState,
	loadConnection,
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

const bootstrapModeForEngine = (engineId: string): "tool" | "command" | "none" => {
	const adapter = allEngineAdapters.find((entry) => entry.id === engineId);
	return adapter?.bootstrap?.mode ?? "none";
};

const bootstrapInputHashForEngine = (
	projectRoot: string,
	config: MimirmeshConfig,
	engineId: string,
): string => {
	const adapter = allEngineAdapters.find((entry) => entry.id === engineId);
	if (!adapter?.bootstrap) {
		return hashValue({ skipped: true });
	}

	return hashValue({
		mode: adapter.bootstrap.mode,
		args: adapter.bootstrap.args(projectRoot, config),
	});
};

export const generateRuntimeFiles = async (
	projectRoot: string,
	config: MimirmeshConfig,
	options: { adapterContext?: RuntimeAdapterContext } = {},
): Promise<{ connection: RuntimeConnection; composeFile: string }> => {
	await materializeRuntimeImages(projectRoot);
	const srclightEvidence = await collectSrclightRepoLocalEvidence(projectRoot);
	const adapterContext = options.adapterContext ?? (await resolveRuntimeAdapterContext(config));
	const compose = renderCompose(projectRoot, config, {
		adapterContext,
	});
	await writeComposeFile(projectRoot, compose);

	const translated = translateAllEngineConfigs(projectRoot, config, adapterContext);
	const existingConnection = await loadConnection(projectRoot);
	const existingBootstrap = await loadBootstrapState(projectRoot);
	const existingBootstrapByEngine = new Map(
		(existingBootstrap?.engines ?? []).map((entry) => [entry.engine, entry]),
	);

	const connection: RuntimeConnection = {
		projectName: config.runtime.projectName,
		composeFile: config.runtime.composeFile,
		updatedAt: new Date().toISOString(),
		startedAt: existingConnection?.startedAt ?? null,
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
		bridgePorts: existingConnection?.bridgePorts ?? {},
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
		engines: translated.map((engine) => {
			const engineId = engine.contract.id;
			const bootstrapMode = bootstrapModeForEngine(engineId);
			const existing = existingBootstrapByEngine.get(engineId);
			const enabled = Boolean(config.engines[engineId].enabled);
			const completedByDefault = !enabled || bootstrapMode === "none";

			return {
				engine: engineId,
				required: Boolean(config.engines[engineId].required),
				mode: bootstrapMode,
				completed: completedByDefault ? true : (existing?.completed ?? false),
				bootstrapInputHash:
					existing?.bootstrapInputHash ??
					bootstrapInputHashForEngine(projectRoot, config, engineId),
				projectRootHash: hashValue(projectRoot),
				lastStartedAt: existing?.lastStartedAt ?? null,
				lastCompletedAt:
					existing?.lastCompletedAt ?? (completedByDefault ? new Date().toISOString() : null),
				failureReason: existing?.failureReason ?? null,
				retryCount: existing?.retryCount ?? 0,
				...(existing?.command ? { command: existing.command } : {}),
				...(existing?.args ? { args: existing.args } : {}),
			};
		}),
	});

	for (const engine of translated) {
		const enabled = Boolean(config.engines[engine.contract.id].enabled);
		const bootstrapMode = bootstrapModeForEngine(engine.contract.id);
		const gpuResolution = adapterContext.gpuResolutions?.[engine.contract.id];
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
							...(gpuResolution
								? {
										gpuMode: gpuResolution.configuredMode,
										effectiveUseGpu: gpuResolution.effectiveUseGpu,
										runtimeVariant: gpuResolution.runtimeVariant,
										hostNvidiaAvailable: gpuResolution.hostNvidiaAvailable,
										gpuResolutionReason: gpuResolution.resolutionReason,
									}
								: {}),
						}
					: {
							bootstrapMode,
						},
		});
	}
	await rm(`${config.runtime.enginesStateDir}/codebase-memory-mcp.json`, { force: true });

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
