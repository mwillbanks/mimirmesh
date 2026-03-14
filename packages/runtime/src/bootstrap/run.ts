import type { EngineId, MimirmeshConfig } from "@mimirmesh/config";
import { allEngineAdapters } from "@mimirmesh/mcp-adapters";

import { callBridgeTool, reconnectBridge } from "../services/bridge";
import { composeExec } from "../services/compose";
import {
	collectSrclightRepoLocalEvidence,
	hashString,
	hashValue,
	persistBootstrapState,
	persistEngineState,
} from "../state/io";
import type { BootstrapEngineState, BootstrapStateFile, EngineRuntimeState } from "../types";

const bootstrapRetryDelayMs = 1_000;
const bootstrapToolAttempts = 3;

const sleep = (durationMs: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, durationMs));

const shouldRetryBootstrapTool = (message: string | undefined): boolean => {
	if (!message) {
		return false;
	}

	const normalized = message.toLowerCase();
	return (
		normalized.includes("timed out") ||
		normalized.includes("aborted") ||
		normalized.includes("socket connection was closed unexpectedly") ||
		normalized.includes("bridge request failed (502)") ||
		normalized.includes("bridge request failed (503)")
	);
};

export const callBootstrapToolWithRetry = async (
	bridgeUrl: string,
	tool: string,
	args: Record<string, unknown>,
): Promise<void> => {
	let lastError = `Bootstrap call failed for ${tool}`;

	for (let attempt = 0; attempt < bootstrapToolAttempts; attempt += 1) {
		try {
			const response = await callBridgeTool(bridgeUrl, { tool, args });
			if (response.ok) {
				return;
			}

			lastError = response.error ?? lastError;
			if (!shouldRetryBootstrapTool(lastError) || attempt === bootstrapToolAttempts - 1) {
				throw new Error(lastError);
			}
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
			if (!shouldRetryBootstrapTool(lastError) || attempt === bootstrapToolAttempts - 1) {
				throw new Error(lastError);
			}
		}

		await reconnectBridge(bridgeUrl).catch(() => undefined);
		await sleep(bootstrapRetryDelayMs * (attempt + 1));
	}

	throw new Error(lastError);
};

export const runBootstrap = async (options: {
	projectRoot: string;
	config: MimirmeshConfig;
	bridgePorts: Partial<Record<EngineId, number>>;
	engineStates: EngineRuntimeState[];
}): Promise<BootstrapStateFile> => {
	const srclightSettings = options.config.engines.srclight.settings as {
		embedModel: string | null;
		defaultEmbedModel: string;
		ollamaBaseUrl: string | null;
	};
	const effectiveEmbedModel =
		(typeof srclightSettings.embedModel === "string" && srclightSettings.embedModel.trim()) ||
		(typeof srclightSettings.defaultEmbedModel === "string" &&
			srclightSettings.defaultEmbedModel.trim()) ||
		null;
	const srclightEmbeddingEnabled = Boolean(effectiveEmbedModel && srclightSettings.ollamaBaseUrl);

	const byEngine = new Map(options.engineStates.map((state) => [state.engine, state]));
	const now = new Date().toISOString();
	const engineBootstrapStates: BootstrapEngineState[] = [];

	for (const adapter of allEngineAdapters) {
		const engineConfig = options.config.engines[adapter.id];
		const current = byEngine.get(adapter.id);
		const bridgePort = options.bridgePorts[adapter.id];
		const bridgeUrl = bridgePort ? `http://127.0.0.1:${bridgePort}` : "";
		const bootstrap = adapter.bootstrap;

		const inputHash = hashValue(
			bootstrap
				? {
						mode: bootstrap.mode,
						args: bootstrap.args(options.projectRoot, options.config),
					}
				: { skipped: true },
		);
		const state: BootstrapEngineState = {
			engine: adapter.id,
			required: Boolean(bootstrap?.required && engineConfig.required),
			mode: bootstrap?.mode ?? "none",
			completed: false,
			bootstrapInputHash: inputHash,
			projectRootHash: hashString(options.projectRoot),
			lastStartedAt: now,
			lastCompletedAt: null,
			failureReason: null,
			retryCount: 0,
		};

		if (!engineConfig.enabled) {
			state.completed = true;
			state.lastCompletedAt = now;
			engineBootstrapStates.push(state);
			if (current) {
				current.lastBootstrapAt = now;
				current.lastBootstrapResult = "skipped";
				await persistEngineState(options.projectRoot, current);
			}
			continue;
		}

		if (!bootstrap) {
			state.completed = true;
			state.lastCompletedAt = now;
			engineBootstrapStates.push(state);
			if (current) {
				current.lastBootstrapAt = now;
				current.lastBootstrapResult = "skipped";
				await persistEngineState(options.projectRoot, current);
			}
			continue;
		}

		if (bootstrap.mode === "tool" && (!current?.bridge.healthy || !bridgeUrl)) {
			state.completed = false;
			state.failureReason = "bridge unavailable";
			engineBootstrapStates.push(state);
			if (current) {
				current.lastBootstrapAt = now;
				current.lastBootstrapResult = "failed";
				current.degradedReason = "bridge unavailable for bootstrap";
				current.health.state = current.required ? "unhealthy" : current.health.state;
				current.health.message = current.required ? "bootstrap failed" : current.health.message;
				await persistEngineState(options.projectRoot, current);
			}
			continue;
		}

		try {
			if (bootstrap.mode === "tool") {
				const args = bootstrap.args(options.projectRoot, options.config);
				await callBootstrapToolWithRetry(bridgeUrl, bootstrap.tool, args);
			} else {
				const args = bootstrap.args(options.projectRoot, options.config);
				state.command = bootstrap.command;
				state.args = args;

				const result = await composeExec(
					options.config,
					options.config.engines[adapter.id].serviceName,
					[bootstrap.command, ...args],
				);

				if (result.exitCode !== 0) {
					throw new Error(
						result.stderr.trim() ||
							result.stdout.trim() ||
							`Bootstrap command failed for ${adapter.id}`,
					);
				}
			}

			state.completed = true;
			state.lastCompletedAt = new Date().toISOString();
			if (current) {
				current.lastBootstrapAt = state.lastCompletedAt;
				current.lastBootstrapResult = "success";
				current.degradedReason = undefined;
				current.capabilityWarnings = [];
				if (current.engine === "srclight") {
					current.runtimeEvidence = {
						...(current.runtimeEvidence ?? {}),
						bootstrapMode: bootstrap.mode,
						...(await collectSrclightRepoLocalEvidence(options.projectRoot)),
					};
				}
				await persistEngineState(options.projectRoot, current);
			}
		} catch (error) {
			state.completed = false;
			state.failureReason = error instanceof Error ? error.message : String(error);
			state.retryCount += 1;
			if (current) {
				current.lastBootstrapAt = new Date().toISOString();
				current.lastBootstrapResult = "failed";
				if (current.engine === "srclight" && srclightEmbeddingEnabled) {
					current.degradedReason = `semantic capabilities degraded: ${state.failureReason}`;
					current.capabilityWarnings = [
						"semantic_search unavailable until embedding bootstrap succeeds",
						"hybrid_search semantic ranking unavailable until embedding bootstrap succeeds",
					];
					current.runtimeEvidence = {
						...(current.runtimeEvidence ?? {}),
						bootstrapMode: bootstrap.mode,
						...(await collectSrclightRepoLocalEvidence(options.projectRoot)),
					};
				} else {
					current.degradedReason = state.failureReason;
					current.health.state = "unhealthy";
					current.health.message = "bootstrap failed";
				}
				await persistEngineState(options.projectRoot, current);
			}
		}

		engineBootstrapStates.push(state);
	}

	const file: BootstrapStateFile = {
		updatedAt: new Date().toISOString(),
		engines: engineBootstrapStates,
	};

	await persistBootstrapState(options.projectRoot, file);
	return file;
};
