import type { EngineId, MimirmeshConfig } from "@mimirmesh/config";

import type { EngineDiscoveredTool, UnifiedRoute } from "@mimirmesh/runtime";

export type RuntimeVariant = "cpu" | "cuda";

export type EngineGpuResolution = {
	engineId: EngineId;
	configuredMode: MimirmeshConfig["runtime"]["gpuMode"];
	engineSupportsGpu: boolean;
	hostNvidiaAvailable: boolean;
	effectiveUseGpu: boolean;
	runtimeVariant: RuntimeVariant;
	resolutionReason: string;
	startupBlocked: boolean;
	startupBlockReason?: string;
};

export type RuntimeAdapterContext = {
	gpuResolutions?: Partial<Record<EngineId, EngineGpuResolution>>;
};

export type EngineRuntimeContract = {
	id: EngineId;
	namespace: string;
	serviceName: string;
	required: boolean;
	dockerfile: string;
	context: string;
	imageTag: string;
	bridgePort: number;
	bridgeTransport: "stdio" | "sse" | "streamable-http";
	bridgeUrl?: string;
	runtimeVariant?: RuntimeVariant;
	env: Record<string, string>;
	mounts: {
		repo: string;
		mimirmesh: string;
	};
};

export type EngineConfigTranslationResult = {
	contract: EngineRuntimeContract;
	errors: string[];
	degraded: boolean;
	degradedReason?: string;
};

export type EngineToolBootstrapDefinition = {
	required: boolean;
	mode: "tool";
	tool: string;
	args: (projectRoot: string, config: MimirmeshConfig) => Record<string, unknown>;
};

export type EngineCommandBootstrapDefinition = {
	required: boolean;
	mode: "command";
	command: string;
	args: (projectRoot: string, config: MimirmeshConfig) => string[];
};

export type EngineBootstrapDefinition =
	| EngineToolBootstrapDefinition
	| EngineCommandBootstrapDefinition;

export type AdapterRoutingRule = {
	unifiedTool: string;
	candidateToolPatterns: RegExp[];
	priority: number;
};

export type PrepareToolInputContext = {
	projectRoot: string;
	config: MimirmeshConfig;
	inputSchema?: Record<string, unknown>;
};

export type UnifiedExecutionResponse = {
	ok: boolean;
	result?: unknown;
	error?: string;
};

export type UnifiedExecutionStep = {
	route: UnifiedRoute;
	response: UnifiedExecutionResponse;
	latencyMs: number;
};

export type UnifiedExecutionContext = {
	unifiedTool: string;
	routes: UnifiedRoute[];
	input: Record<string, unknown>;
	projectRoot: string;
	config: MimirmeshConfig;
	bridgePorts: Partial<Record<EngineId, number>>;
	invoke: (tool: string, args: Record<string, unknown>) => Promise<UnifiedExecutionResponse>;
};

export type EngineAdapterModule = {
	id: EngineId;
	namespace: string;
	translateConfig: (
		projectRoot: string,
		config: MimirmeshConfig,
		context?: RuntimeAdapterContext,
	) => EngineConfigTranslationResult;
	bootstrap: EngineBootstrapDefinition | null;
	routingRules: AdapterRoutingRule[];
	resolveUnifiedRoutes: (tools: EngineDiscoveredTool[]) => UnifiedRoute[];
	prepareToolInput?: (
		toolName: string,
		input: Record<string, unknown>,
		context: PrepareToolInputContext,
	) => Record<string, unknown>;
	executeUnifiedTool?: (context: UnifiedExecutionContext) => Promise<UnifiedExecutionStep[] | null>;
};
