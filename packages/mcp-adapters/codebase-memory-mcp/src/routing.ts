import { basename } from "node:path";

import type { EngineDiscoveredTool, UnifiedRoute } from "@mimirmesh/runtime";
import type {
	AdapterRoutingRule,
	UnifiedExecutionContext,
	UnifiedExecutionStep,
} from "../../src/types";
import { resolveRoutesFromPatterns } from "../../src/utils";

export const codebaseRoutingRules: AdapterRoutingRule[] = [
	{ unifiedTool: "explain_project", candidateToolPatterns: [/get_architecture/i], priority: 100 },
	{
		unifiedTool: "explain_subsystem",
		candidateToolPatterns: [/get_architecture/i, /search_graph/i],
		priority: 90,
	},
	{
		unifiedTool: "find_symbol",
		candidateToolPatterns: [/search_graph/i, /get_code_snippet/i],
		priority: 100,
	},
	{ unifiedTool: "search_code", candidateToolPatterns: [/search_code/i], priority: 95 },
	{
		unifiedTool: "trace_dependency",
		candidateToolPatterns: [/trace_call_path/i, /query_graph/i],
		priority: 95,
	},
	{
		unifiedTool: "trace_integration",
		candidateToolPatterns: [/query_graph/i, /search_graph/i],
		priority: 80,
	},
	{
		unifiedTool: "investigate_issue",
		candidateToolPatterns: [/detect_changes/i, /trace_call_path/i, /search_code/i],
		priority: 95,
	},
	{
		unifiedTool: "evaluate_codebase",
		candidateToolPatterns: [/get_architecture/i, /get_graph_schema/i],
		priority: 85,
	},
	{ unifiedTool: "generate_adr", candidateToolPatterns: [/manage_adr/i], priority: 60 },
];

const firstString = (...values: unknown[]): string => {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}
	return "";
};

const firstNumber = (...values: unknown[]): number | undefined => {
	for (const value of values) {
		if (typeof value === "number" && Number.isFinite(value) && value > 0) {
			return Math.floor(value);
		}
	}
	return undefined;
};

const normalizePath = (value: string): string => value.replaceAll("\\", "/");

const isLikelyIdentifier = (value: string): boolean => /^[A-Za-z_][A-Za-z0-9_.:$#-]*$/.test(value);

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toNamePattern = (value: string): string => {
	const tokens = value
		.split(/\s+/)
		.map((token) => token.trim())
		.filter(Boolean);
	if (tokens.length === 0) {
		return "";
	}

	return tokens.length === 1
		? `.*${escapeRegex(tokens[0] ?? "")}.*`
		: `${tokens.map((token) => `(?=.*${escapeRegex(token)})`).join("")}.*`;
};

const routeByTool = (routes: UnifiedRoute[], toolName: string): UnifiedRoute | undefined =>
	routes.find((route) => route.engineTool === toolName);

const executeRoute = async (
	context: UnifiedExecutionContext,
	toolName: string,
	args: Record<string, unknown>,
): Promise<UnifiedExecutionStep | null> => {
	const route = routeByTool(context.routes, toolName);
	if (!route) {
		return null;
	}

	const startedAt = performance.now();
	const response = await context.invoke(toolName, args);
	return {
		route,
		response,
		latencyMs: Math.round(performance.now() - startedAt),
	};
};

const resultRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const searchGraphResults = (value: unknown): Array<Record<string, unknown>> => {
	const record = resultRecord(value);
	return Array.isArray(record?.results)
		? record.results.filter(
				(entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null,
			)
		: [];
};

const searchScope = (input: Record<string, unknown>): { label: string; filePattern?: string } => {
	const path = firstString(input.path, input.filePath, input.file_path);
	if (!path) {
		return {
			label: firstString(input.subsystem, input.query, input.context),
		};
	}

	const normalized = normalizePath(path).replace(/^\/+/, "").replace(/\/+$/, "");
	const filePattern = normalized.includes(".") ? `**/${normalized}` : `${normalized}/**`;

	return {
		label: basename(normalized) || normalized,
		filePattern,
	};
};

export const resolveCodebaseRoutes = (tools: EngineDiscoveredTool[]): UnifiedRoute[] =>
	resolveRoutesFromPatterns("codebase-memory-mcp", tools, codebaseRoutingRules);

export const executeCodebaseUnifiedTool = async (
	context: UnifiedExecutionContext,
): Promise<UnifiedExecutionStep[] | null> => {
	const query = firstString(context.input.query, context.input.search_text, context.input.prompt);
	const symbol = firstString(
		context.input.symbol,
		context.input.name,
		context.input.identifier,
		query,
	);
	const limit = firstNumber(context.input.limit, context.input.max_results);

	switch (context.unifiedTool) {
		case "explain_subsystem": {
			const scope = searchScope(context.input);
			const step = await executeRoute(context, "search_graph", {
				...(scope.label ? { name_pattern: toNamePattern(scope.label) } : {}),
				...(scope.filePattern ? { file_pattern: scope.filePattern } : {}),
				...(limit ? { limit } : { limit: 10 }),
			});
			return step ? [step] : [];
		}
		case "find_symbol": {
			const searchStep = await executeRoute(context, "search_graph", {
				...(query ? { name_pattern: toNamePattern(query) } : {}),
				...(limit ? { limit } : { limit: 10 }),
			});
			if (!searchStep) {
				return [];
			}

			const results = searchGraphResults(searchStep.response.result);
			const firstMatch = results[0];
			const qualifiedName =
				typeof firstMatch?.qualified_name === "string" ? firstMatch.qualified_name : "";
			const snippetStep =
				qualifiedName && routeByTool(context.routes, "get_code_snippet")
					? await executeRoute(context, "get_code_snippet", {
							qualified_name: qualifiedName,
						})
					: null;

			return [searchStep, ...(snippetStep ? [snippetStep] : [])];
		}
		case "search_code": {
			const step = await executeRoute(context, "search_code", {
				...(query ? { pattern: query } : {}),
				...(typeof context.input.regex === "boolean" ? { regex: context.input.regex } : {}),
				...(typeof context.input.file_pattern === "string"
					? { file_pattern: context.input.file_pattern }
					: {}),
				...(limit ? { max_results: limit } : {}),
			});
			return step ? [step] : [];
		}
		case "trace_dependency": {
			if (!isLikelyIdentifier(symbol)) {
				return [];
			}

			const step = await executeRoute(context, "trace_call_path", {
				function_name: symbol,
				direction: typeof context.input.direction === "string" ? context.input.direction : "both",
				...(typeof context.input.depth === "number" ? { depth: context.input.depth } : {}),
			});
			return step ? [step] : [];
		}
		case "trace_integration": {
			if (
				typeof context.input.query === "string" &&
				context.input.query.trim().startsWith("MATCH ")
			) {
				const graphStep = await executeRoute(context, "query_graph", {
					query: context.input.query,
				});
				return graphStep ? [graphStep] : [];
			}

			const step = await executeRoute(context, "search_graph", {
				...(query ? { name_pattern: toNamePattern(query) } : {}),
				relationship: "HTTP_CALLS",
				...(limit ? { limit } : { limit: 10 }),
			});
			return step ? [step] : [];
		}
		case "investigate_issue": {
			const steps: UnifiedExecutionStep[] = [];
			const changesStep = await executeRoute(context, "detect_changes", {});
			if (changesStep) {
				steps.push(changesStep);
			}

			if (query) {
				const searchStep = await executeRoute(context, "search_code", {
					pattern: query,
					...(limit ? { max_results: limit } : {}),
				});
				if (searchStep) {
					steps.push(searchStep);
				}
			}

			if (isLikelyIdentifier(symbol)) {
				const traceStep = await executeRoute(context, "trace_call_path", {
					function_name: symbol,
					direction: "both",
				});
				if (traceStep) {
					steps.push(traceStep);
				}
			}

			return steps;
		}
		default:
			return null;
	}
};
