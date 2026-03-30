import type { EngineId, MimirmeshConfig } from "@mimirmesh/config";
import type { LogChannel } from "@mimirmesh/logging";
import type {
	RouteExecutionStrategy,
	RouteHintCacheAffinity,
	RouteHintFreshnessSensitivity,
	RouteHintFreshnessState,
	RouteHintSnapshot,
	RouteHintSourceLabel,
	RouteHintSourceMode,
	RouteSeedHint,
	RouteTelemetryHealthState,
	RouteTelemetryMaintenanceProgress,
	RouteTelemetryMaintenanceState,
} from "@mimirmesh/runtime";

export type UnifiedToolName =
	| "skills.find"
	| "skills.read"
	| "skills.resolve"
	| "skills.refresh"
	| "skills.create"
	| "skills.update"
	| "explain_project"
	| "explain_subsystem"
	| "find_symbol"
	| "find_tests"
	| "inspect_type_hierarchy"
	| "inspect_platform_code"
	| "list_workspace_projects"
	| "refresh_index"
	| "search_code"
	| "search_docs"
	| "trace_dependency"
	| "trace_integration"
	| "investigate_issue"
	| "evaluate_codebase"
	| "generate_adr"
	| "document_feature"
	| "document_architecture"
	| "document_runbook"
	| "runtime_status"
	| "config_get"
	| "config_set"
	| "load_deferred_tools"
	| "refresh_tool_surface"
	| "inspect_tool_schema"
	| "inspect_route_hints";

export type ToolName = UnifiedToolName | string;

export type ToolInput = Record<string, unknown>;

export type ToolResultItem = {
	id: string;
	title: string;
	content: string;
	score: number;
	metadata: Record<string, unknown>;
};

export type ToolProvenance = {
	engine: string;
	tool: string;
	latencyMs: number;
	health: "healthy" | "degraded" | "unavailable";
	note?: string;
};

export type ToolWarningCode =
	| "runtime_restart_required"
	| "mcp_server_stale"
	| "bridge_unhealthy"
	| "upstream_tool_fallback_used";

export type NormalizedToolResult = {
	tool: ToolName;
	success: boolean;
	message: string;
	items: ToolResultItem[];
	provenance: ToolProvenance[];
	degraded: boolean;
	warnings: string[];
	warningCodes: ToolWarningCode[];
	nextAction?: string;
	raw?: Record<string, unknown>;
};

export type ToolDefinition = {
	name: ToolName;
	description: string;
	type: "unified" | "passthrough" | "management";
	originEngine?: EngineId | "mimirmesh";
	sessionState?: "core" | "loaded" | "deferred-indicator";
	compressionLevel?: MimirmeshConfig["mcp"]["toolSurface"]["compressionLevel"];
	argumentHints?: string[];
	inputSchema?: Record<string, unknown>;
	fullSchemaAvailable?: boolean;
};

export type MiddlewareContext = {
	toolName: ToolName;
	input: ToolInput;
	projectRoot: string;
	config: MimirmeshConfig;
};

export type ToolExecutor = (context: MiddlewareContext) => Promise<NormalizedToolResult>;

export type ToolMiddleware = (
	context: MiddlewareContext,
	next: ToolExecutor,
) => Promise<NormalizedToolResult>;

export type ToolRouterOptions = {
	projectRoot: string;
	config: MimirmeshConfig;
	sessionId?: string;
	adapters?: unknown[];
	adapterResolver?: typeof import("@mimirmesh/mcp-adapters").getAdapter;
	engineInvoker?: typeof import("../transport/bridge").invokeEngineTool;
	logger?: {
		log: (
			channel: LogChannel,
			level: "debug" | "info" | "warn" | "error",
			message: string,
		) => Promise<void>;
		error: (message: string, details?: string) => Promise<void>;
	};
	middlewares?: ToolMiddleware[];
};

export type ToolSchemaDetailLevel = "compressed" | "full" | "debug";

export type ToolSchemaInspection = {
	toolName: ToolName;
	sessionId: string;
	detailLevel: ToolSchemaDetailLevel;
	resolvedEngine: EngineId | "mimirmesh";
	schemaPayload: Record<string, unknown>;
};

export type ToolSurfaceSummary = {
	sessionId: string;
	policyVersion: string;
	compressionLevel: MimirmeshConfig["mcp"]["toolSurface"]["compressionLevel"];
	coreToolCount: number;
	toolCount: number;
	loadedEngineGroups: EngineId[];
	deferredEngineGroups: Array<{
		engineId: EngineId;
		displayName: string;
		toolCount: number;
		availabilityState: "deferred" | "loaded" | "unavailable" | "degraded";
		healthMessage: string;
		lastDiscoveredAt: string | null;
	}>;
	tools: ToolDefinition[];
	diagnostics: Array<{
		engineId: EngineId;
		outcome: "success" | "degraded" | "failed";
		completedAt: string;
		message: string;
	}>;
};

export type RoutingEngineRoute = {
	unifiedTool: UnifiedToolName;
	engine: EngineId;
	engineTool: string;
	priority: number;
	executionStrategy?: RouteExecutionStrategy;
	seedHint?: RouteSeedHint | null;
	inputSchema?: Record<string, unknown>;
};

export type RouteHintInspectionOrdering = Pick<
	RouteHintSnapshot,
	| "engine"
	| "engineTool"
	| "effectiveCostScore"
	| "confidence"
	| "sampleCount"
	| "orderingReasonCodes"
	| "estimatedInputTokens"
	| "estimatedOutputTokens"
	| "estimatedLatencyMs"
	| "estimatedSuccessRate"
	| "lastObservedAt"
>;

export type RouteHintInspectionSummary = {
	unifiedTool: UnifiedToolName;
	profileScope: "summary";
	profiles: Array<{
		profileKey: string;
		subsetEligible: boolean;
		executionStrategy: RouteExecutionStrategy;
		sourceMode: RouteHintSourceMode;
		sourceLabel: RouteHintSourceLabel;
		freshnessState: RouteHintFreshnessState;
		freshnessAgeSeconds: number | null;
		confidence: number;
		sampleCount: number;
		currentOrdering: RouteHintInspectionOrdering[];
	}>;
};

export type RouteHintInspectionProfile = {
	unifiedTool: UnifiedToolName;
	profileScope: "profile";
	profileKey: string;
	subsetEligible: boolean;
	executionStrategy: RouteExecutionStrategy;
	sourceMode: RouteHintSourceMode;
	sourceLabel: RouteHintSourceLabel;
	freshnessState: RouteHintFreshnessState;
	freshnessAgeSeconds: number | null;
	currentOrdering: RouteHintInspectionOrdering[];
	recentRollups?: {
		last15m: unknown[];
		last6h: unknown[];
		last1d: unknown[];
	};
};

export type RouteHintInspectionResponse = {
	telemetryHealth: {
		state: RouteTelemetryHealthState;
		lastSuccessfulCompactionAt: string | null;
		lagSeconds: number;
		warnings: string[];
	};
	maintenanceStatus: RouteTelemetryMaintenanceState & {
		compactionProgress: RouteTelemetryMaintenanceProgress;
		rawRetentionDays: number;
		rollupRetention: {
			last15mHours: number;
			last6hDays: number;
			last1dDays: number;
		};
		overdueBySeconds: number;
		affectedSourceLabels: RouteHintSourceLabel[];
	};
	adaptiveSubset: {
		defaultAllowlist: UnifiedToolName[];
		effectiveAllowlist: UnifiedToolName[];
		overrideWarnings: string[];
	};
	inspection?: RouteHintInspectionSummary | RouteHintInspectionProfile;
};

export type RouteHintSeedSummary = Pick<
	RouteSeedHint,
	| "estimatedInputTokens"
	| "estimatedOutputTokens"
	| "estimatedLatencyMs"
	| "expectedSuccessRate"
	| "cacheAffinity"
	| "freshnessSensitivity"
>;

export type RouteHintScoreBreakdown = {
	tokenScore: number;
	latencyScore: number;
	reliabilityPenalty: number;
	freshnessModifier: number;
	cacheModifier: number;
	effectiveCostScore: number;
	cacheAffinity: RouteHintCacheAffinity;
	freshnessSensitivity: RouteHintFreshnessSensitivity;
};

export type PassthroughMapping = {
	publicTool: string;
	engine: EngineId;
	engineTool: string;
	description?: string;
	publication?: {
		canonicalEngineId: string;
		publishedTool: string;
		retiredAliases: string[];
	};
};
