import type { EngineId, MimirmeshConfig } from "@mimirmesh/config";
import type { LogChannel } from "@mimirmesh/logging";

export type UnifiedToolName =
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
	| "config_set";

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
	type: "unified" | "passthrough";
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
	adapters?: unknown[];
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

export type RoutingEngineRoute = {
	unifiedTool: UnifiedToolName;
	engine: EngineId;
	engineTool: string;
	priority: number;
	inputSchema?: Record<string, unknown>;
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
