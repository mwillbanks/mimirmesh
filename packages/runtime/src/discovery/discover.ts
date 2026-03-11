import type { EngineId, MimirmeshConfig } from "@mimirmesh/config";
import { allEngineAdapters, getAdapter } from "@mimirmesh/mcp-adapters";
import { checkBridgeHealth, discoverBridgeTools } from "../services/bridge";
import { collectSrclightRepoLocalEvidence, hashValue, persistEngineState } from "../state/io";
import type { EngineRuntimeState, PassthroughRoute, RoutingTable, UnifiedRoute } from "../types";

const normalizeForNamespace = (tool: string): string =>
	tool
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "_")
		.replace(/^_+|_+$/g, "") || "tool";

const passthroughName = (namespace: string, tool: string): string => {
	const suffix = normalizeForNamespace(tool);
	return `${namespace}.${suffix}`;
};

const routePriority = (engine: UnifiedRoute["engine"]): number => {
	switch (engine) {
		case "srclight":
			return 3;
		case "codebase-memory-mcp":
			return 2;
		default:
			return 1;
	}
};

export const discoverEngineCapability = async (options: {
	projectRoot: string;
	config: MimirmeshConfig;
	bridgePorts: Partial<Record<EngineId, number>>;
	startedAt: string;
	attempts?: number;
	delayMs?: number;
}): Promise<{
	states: EngineRuntimeState[];
	routingTable: RoutingTable;
}> => {
	const states: EngineRuntimeState[] = [];
	const passthrough: PassthroughRoute[] = [];
	const unified: UnifiedRoute[] = [];
	const attempts = Math.max(1, options.attempts ?? 1);
	const delayMs = Math.max(0, options.delayMs ?? 0);

	const sleep = async (): Promise<void> => {
		if (delayMs === 0) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	};

	for (const adapter of allEngineAdapters) {
		const srclightEvidence =
			adapter.id === "srclight"
				? await collectSrclightRepoLocalEvidence(options.projectRoot)
				: null;
		const engineConfig = options.config.engines[adapter.id];
		const translated = getAdapter(adapter.id).translateConfig(options.projectRoot, options.config);
		const port = options.bridgePorts[adapter.id];
		const url = port ? `http://127.0.0.1:${port}` : "";

		let healthMessage = "Bridge unavailable";
		let bridgeHealthy = false;
		let discoveredTools: EngineRuntimeState["discoveredTools"] = [];
		let degradedReason: string | undefined = translated.degradedReason;

		if (engineConfig.enabled && port) {
			for (let attempt = 0; attempt < attempts; attempt += 1) {
				let healthReady = false;

				try {
					const health = await checkBridgeHealth(url);
					healthReady = Boolean(health.ok && health.ready && health.child?.running);
					healthMessage = healthReady ? "healthy" : (health.child?.lastError ?? "bridge not ready");
				} catch (error) {
					healthMessage = error instanceof Error ? error.message : String(error);
					degradedReason = degradedReason ?? healthMessage;
				}

				try {
					const discovery = await discoverBridgeTools(url, adapter.id);
					discoveredTools = discovery.tools ?? [];
					bridgeHealthy = true;
					healthMessage = "healthy";
					degradedReason = translated.degradedReason;
					break;
				} catch (error) {
					const discoveryError = error instanceof Error ? error.message : String(error);
					if (!healthReady || !healthMessage || healthMessage === "healthy") {
						healthMessage = discoveryError;
					}
					degradedReason = degradedReason ?? discoveryError;
				}

				if (attempt < attempts - 1) {
					await sleep();
				}
			}
		} else if (!engineConfig.enabled) {
			healthMessage = "disabled";
		} else {
			degradedReason = degradedReason ?? "bridge port not resolved";
		}

		const state: EngineRuntimeState = {
			engine: adapter.id,
			enabled: engineConfig.enabled,
			required: engineConfig.required,
			namespace: adapter.namespace,
			serviceName: translated.contract.serviceName,
			imageTag: translated.contract.imageTag,
			configHash: hashValue(translated.contract.env),
			discoveredTools,
			health: {
				state: bridgeHealthy ? "healthy" : engineConfig.enabled ? "unhealthy" : "unknown",
				message: healthMessage,
				checkedAt: new Date().toISOString(),
			},
			bridge: {
				url,
				transport: translated.contract.bridgeTransport,
				healthy: bridgeHealthy,
				checkedAt: new Date().toISOString(),
				lastError: bridgeHealthy ? undefined : healthMessage,
			},
			lastStartupAt: options.startedAt,
			lastBootstrapAt: null,
			lastBootstrapResult: "pending",
			degradedReason,
			capabilityWarnings: [],
			runtimeEvidence:
				adapter.id === "srclight"
					? {
						bootstrapMode: "command",
						...(srclightEvidence ?? {}),
					}
					: {
						bootstrapMode: adapter.id === "codebase-memory-mcp" ? "tool" : "none",
					},
		};

		states.push(state);
		await persistEngineState(options.projectRoot, state);

		if (!engineConfig.enabled || !bridgeHealthy) {
			continue;
		}

		for (const tool of discoveredTools) {
			passthrough.push({
				publicTool: passthroughName(adapter.namespace, tool.name),
				engine: adapter.id,
				engineTool: tool.name,
				description: tool.description,
				inputSchema: tool.inputSchema,
			});
		}

		unified.push(...adapter.resolveUnifiedRoutes(discoveredTools));
	}

	const dedupUnified = unified
		.sort((a, b) => b.priority - a.priority || routePriority(b.engine) - routePriority(a.engine))
		.filter(
			(route, index, array) =>
				array.findIndex(
					(entry) =>
						entry.unifiedTool === route.unifiedTool &&
						entry.engine === route.engine &&
						entry.engineTool === route.engineTool,
				) === index,
		);

	return {
		states,
		routingTable: {
			generatedAt: new Date().toISOString(),
			passthrough,
			unified: dedupUnified,
		},
	};
};
