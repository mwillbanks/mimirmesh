import type { EngineDiscoveredTool, UnifiedRoute } from "@mimirmesh/runtime";
import type {
	AdapterRoutingRule,
	UnifiedExecutionContext,
	UnifiedExecutionStep,
} from "../../src/types";
import { resolveRoutesFromPatterns } from "../../src/utils";

export const srclightRoutingRules: AdapterRoutingRule[] = [
	{ unifiedTool: "explain_project", candidateToolPatterns: [/codebase_map/i], priority: 160 },
	{
		unifiedTool: "explain_subsystem",
		candidateToolPatterns: [/get_symbol/i, /symbols_in_file/i, /search_symbols/i],
		priority: 145,
	},
	{
		unifiedTool: "find_symbol",
		candidateToolPatterns: [/search_symbols/i, /get_symbol/i, /get_signature/i],
		priority: 150,
	},
	{
		unifiedTool: "search_code",
		candidateToolPatterns: [/hybrid_search/i, /semantic_search/i, /search_symbols/i],
		priority: 150,
	},
	{
		unifiedTool: "trace_dependency",
		candidateToolPatterns: [/get_callers/i, /get_callees/i, /get_dependents/i],
		priority: 145,
	},
	{
		unifiedTool: "trace_integration",
		candidateToolPatterns: [/get_dependents/i, /get_implementors/i, /get_build_targets/i],
		priority: 135,
	},
	{
		unifiedTool: "investigate_issue",
		candidateToolPatterns: [/hybrid_search/i, /whats_changed/i, /recent_changes/i, /blame_symbol/i],
		priority: 140,
	},
	{
		unifiedTool: "evaluate_codebase",
		candidateToolPatterns: [/codebase_map/i, /git_hotspots/i, /index_status/i, /embedding_health/i],
		priority: 140,
	},
];

const symbolToolNames = new Set([
	"search_symbols",
	"get_symbol",
	"get_signature",
	"get_callers",
	"get_callees",
	"get_dependents",
	"get_implementors",
	"get_tests_for",
	"get_type_hierarchy",
	"blame_symbol",
]);

const queryToolNames = new Set(["semantic_search", "hybrid_search", "search_symbols"]);

const fileToolNames = new Set(["symbols_in_file"]);

const emptyInputToolNames = new Set([
	"codebase_map",
	"index_status",
	"embedding_status",
	"embedding_health",
	"recent_changes",
	"whats_changed",
	"git_hotspots",
]);

const firstString = (...values: unknown[]): string => {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}
	return "";
};

export const prepareSrclightToolInput = (
	toolName: string,
	input: Record<string, unknown>,
): Record<string, unknown> => {
	if (emptyInputToolNames.has(toolName)) {
		return {};
	}

	if (fileToolNames.has(toolName)) {
		const filePath = firstString(input.file_path, input.filePath, input.path, input.uri);
		return filePath ? { file_path: filePath } : input;
	}

	if (symbolToolNames.has(toolName)) {
		const symbol = firstString(input.symbol, input.query, input.name, input.identifier);
		return symbol ? { symbol } : input;
	}

	if (queryToolNames.has(toolName)) {
		const query = firstString(input.query, input.search_text, input.symbol, input.name);
		if (!query) {
			return input;
		}

		return {
			query,
			...(typeof input.limit === "number" ? { limit: input.limit } : {}),
			...(typeof input.max_results === "number" ? { limit: input.max_results } : {}),
		};
	}

	return input;
};

const executeRoutes = async (
	context: UnifiedExecutionContext,
	routes: UnifiedRoute[],
): Promise<UnifiedExecutionStep[]> => {
	const steps = await Promise.all(
		routes.map(async (route) => {
			const startedAt = performance.now();
			const response = await context.invoke(
				route.engineTool,
				prepareSrclightToolInput(route.engineTool, context.input),
			);

			return {
				route,
				response,
				latencyMs: Math.round(performance.now() - startedAt),
			};
		}),
	);

	return steps;
};

export const resolveSrclightRoutes = (tools: EngineDiscoveredTool[]): UnifiedRoute[] =>
	resolveRoutesFromPatterns("srclight", tools, srclightRoutingRules);

export const executeSrclightUnifiedTool = async (
	context: UnifiedExecutionContext,
): Promise<UnifiedExecutionStep[] | null> => {
	switch (context.unifiedTool) {
		case "explain_project": {
			const preferred = context.routes.filter((route) => /codebase_map/i.test(route.engineTool));
			return executeRoutes(context, preferred.length > 0 ? preferred : context.routes.slice(0, 1));
		}
		case "explain_subsystem":
		case "find_symbol":
		case "search_code":
		case "trace_dependency":
		case "trace_integration":
		case "investigate_issue":
		case "evaluate_codebase":
			return executeRoutes(context, context.routes);
		default:
			return null;
	}
};
