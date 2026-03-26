import type { EngineId, MimirmeshConfig } from "@mimirmesh/config";
import {
	buildLegacyPassthroughToolName,
	buildPublishedPassthroughToolName,
	getAdapter,
} from "@mimirmesh/mcp-adapters";
import {
	createDefaultMcpToolSurfaceSession,
	discoverBridgeTools,
	type EngineDiscoveredTool,
	hashValue,
	loadEngineState,
	loadMcpToolSurfaceSession,
	loadRoutingTable,
	loadRuntimeConnection,
	type McpToolSurfaceSession,
	persistEngineState,
	persistMcpToolSurfaceSession,
	persistRoutingTable,
	type RoutingTable,
	type RuntimeConnection,
} from "@mimirmesh/runtime";

export const loadRuntimeRoutingContext = async (
	projectRoot: string,
): Promise<{
	routing: RoutingTable | null;
	connection: RuntimeConnection | null;
}> => {
	const [routing, connection] = await Promise.all([
		loadRoutingTable(projectRoot),
		loadRuntimeConnection(projectRoot),
	]);
	return { routing, connection };
};

export const toolSurfacePolicyVersion = (config: MimirmeshConfig): string =>
	hashValue(config.mcp.toolSurface);

export const loadOrCreateMcpToolSurfaceSession = async (
	projectRoot: string,
	config: MimirmeshConfig,
	sessionId: string,
): Promise<McpToolSurfaceSession> => {
	const existing = await loadMcpToolSurfaceSession(projectRoot, sessionId);
	if (existing) {
		return existing;
	}
	const session = createDefaultMcpToolSurfaceSession({
		sessionId,
		policyVersion: toolSurfacePolicyVersion(config),
		compressionLevel: config.mcp.toolSurface.compressionLevel,
	});
	await persistMcpToolSurfaceSession(projectRoot, session);
	return session;
};

const mergeEngineRoutes = (
	routing: RoutingTable | null,
	engine: EngineId,
	tools: EngineDiscoveredTool[],
) => {
	const adapter = getAdapter(engine);
	const passthroughRoutes = tools.map((tool) => {
		const publicTool = buildLegacyPassthroughToolName(adapter.namespace, tool.name);
		return {
			publicTool,
			engine,
			engineTool: tool.name,
			description: tool.description,
			inputSchema: tool.inputSchema,
			publication: adapter.passthroughPublication?.eligibleForPublication
				? {
						canonicalEngineId: adapter.passthroughPublication.canonicalId,
						publishedTool: buildPublishedPassthroughToolName(
							adapter.passthroughPublication.canonicalId,
							tool.name,
						),
						retiredAliases: [publicTool],
					}
				: undefined,
		};
	});
	const unifiedRoutes =
		typeof adapter.resolveUnifiedRoutes === "function" ? adapter.resolveUnifiedRoutes(tools) : [];

	return {
		generatedAt: new Date().toISOString(),
		passthrough: [
			...(routing?.passthrough ?? []).filter((route) => route.engine !== engine),
			...passthroughRoutes,
		],
		unified: [
			...(routing?.unified ?? []).filter((route) => route.engine !== engine),
			...unifiedRoutes,
		].sort((left, right) => right.priority - left.priority),
	} satisfies RoutingTable;
};

export const refreshDeferredEngineDiscovery = async (options: {
	projectRoot: string;
	config: MimirmeshConfig;
	engine: EngineId;
}): Promise<{
	routing: RoutingTable;
	discoveredToolCount: number;
	healthMessage: string;
}> => {
	const { projectRoot, config, engine } = options;
	const [connection, routing, existingState] = await Promise.all([
		loadRuntimeConnection(projectRoot),
		loadRoutingTable(projectRoot),
		loadEngineState(projectRoot, engine),
	]);
	const port = connection?.bridgePorts[engine];
	if (!connection || !port) {
		throw new Error(`Runtime bridge for ${engine} is not available.`);
	}

	const bridgeUrl = `http://127.0.0.1:${port}`;
	const discovery = await discoverBridgeTools(bridgeUrl, engine);
	const nextState = {
		...(existingState ?? {
			engine,
			enabled: config.engines[engine].enabled,
			required: config.engines[engine].required,
			namespace: getAdapter(engine).namespace,
			serviceName: config.engines[engine].serviceName,
			imageTag: config.engines[engine].image.tag,
			configHash: hashValue(config.engines[engine]),
			lastStartupAt: null,
			lastBootstrapAt: null,
			lastBootstrapResult: "pending" as const,
			degradedReason: undefined,
			capabilityWarnings: [],
			runtimeEvidence: {
				bootstrapMode: getAdapter(engine).bootstrap?.mode ?? "none",
			},
		}),
		discoveredTools: discovery.tools ?? [],
		health: {
			state: "healthy" as const,
			message: "healthy",
			checkedAt: new Date().toISOString(),
		},
		bridge: {
			url: bridgeUrl,
			transport: existingState?.bridge.transport ?? (engine === "srclight" ? "sse" : "stdio"),
			healthy: true,
			checkedAt: new Date().toISOString(),
			lastError: undefined,
		},
	};
	await persistEngineState(projectRoot, nextState);
	const nextRouting = mergeEngineRoutes(routing, engine, discovery.tools ?? []);
	await persistRoutingTable(projectRoot, nextRouting);
	return {
		routing: nextRouting,
		discoveredToolCount: discovery.tools?.length ?? 0,
		healthMessage: "healthy",
	};
};
