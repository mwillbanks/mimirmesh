import { basename } from "node:path";

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
		executionStrategy: "fallback-only",
		seedHintsByTool: {
			search_symbols: {
				adaptiveEligible: true,
				estimatedInputTokens: 70,
				estimatedOutputTokens: 36,
				estimatedLatencyMs: 190,
				expectedSuccessRate: 0.95,
				cacheAffinity: "medium",
				freshnessSensitivity: "medium",
			},
			get_symbol: {
				adaptiveEligible: true,
				estimatedInputTokens: 18,
				estimatedOutputTokens: 14,
				estimatedLatencyMs: 70,
				expectedSuccessRate: 0.98,
				cacheAffinity: "high",
				freshnessSensitivity: "low",
			},
			get_signature: {
				adaptiveEligible: true,
				estimatedInputTokens: 20,
				estimatedOutputTokens: 10,
				estimatedLatencyMs: 85,
				expectedSuccessRate: 0.97,
				cacheAffinity: "high",
				freshnessSensitivity: "low",
			},
		},
	},
	{
		unifiedTool: "find_tests",
		candidateToolPatterns: [/get_tests_for/i],
		priority: 150,
	},
	{
		unifiedTool: "inspect_type_hierarchy",
		candidateToolPatterns: [/get_type_hierarchy/i],
		priority: 150,
	},
	{
		unifiedTool: "inspect_platform_code",
		candidateToolPatterns: [/get_platform_variants/i, /platform_conditionals/i],
		priority: 150,
	},
	{
		unifiedTool: "list_workspace_projects",
		candidateToolPatterns: [/list_projects/i],
		priority: 150,
	},
	{
		unifiedTool: "refresh_index",
		candidateToolPatterns: [/reindex/i],
		priority: 150,
	},
	{
		unifiedTool: "search_code",
		candidateToolPatterns: [/hybrid_search/i, /semantic_search/i, /search_symbols/i],
		priority: 150,
		executionStrategy: "fallback-only",
		seedHintsByTool: {
			hybrid_search: {
				adaptiveEligible: true,
				estimatedInputTokens: 100,
				estimatedOutputTokens: 40,
				estimatedLatencyMs: 300,
				expectedSuccessRate: 0.96,
				cacheAffinity: "high",
				freshnessSensitivity: "medium",
			},
			semantic_search: {
				adaptiveEligible: true,
				estimatedInputTokens: 84,
				estimatedOutputTokens: 28,
				estimatedLatencyMs: 220,
				expectedSuccessRate: 0.93,
				cacheAffinity: "medium",
				freshnessSensitivity: "high",
			},
			search_symbols: {
				adaptiveEligible: true,
				estimatedInputTokens: 62,
				estimatedOutputTokens: 24,
				estimatedLatencyMs: 140,
				expectedSuccessRate: 0.89,
				cacheAffinity: "medium",
				freshnessSensitivity: "medium",
			},
		},
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
		executionStrategy: "fanout",
	},
	{
		unifiedTool: "investigate_issue",
		candidateToolPatterns: [
			/hybrid_search/i,
			/whats_changed/i,
			/recent_changes/i,
			/blame_symbol/i,
			/changes_to/i,
		],
		priority: 140,
	},
	{
		unifiedTool: "evaluate_codebase",
		candidateToolPatterns: [
			/codebase_map/i,
			/git_hotspots/i,
			/index_status/i,
			/embedding_health/i,
			/embedding_status/i,
		],
		priority: 140,
		executionStrategy: "fanout",
	},
];

const emptyInputToolNames = new Set([
	"codebase_map",
	"index_status",
	"embedding_status",
	"embedding_health",
	"recent_changes",
	"whats_changed",
	"git_hotspots",
	"get_build_targets",
	"platform_conditionals",
	"reindex",
	"setup_guide",
	"server_stats",
	"restart_server",
]);

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

const isLikelyFilePath = (value: string): boolean => {
	const normalized = normalizePath(value);
	return normalized.includes("/") || normalized.includes(".");
};

const isLikelyIdentifier = (value: string): boolean => /^[A-Za-z_][A-Za-z0-9_.:$#-]*$/.test(value);

const symbolLikeValue = (input: Record<string, unknown>): string =>
	firstString(input.symbol, input.name, input.identifier, input.query);

const subsystemLabel = (input: Record<string, unknown>): string => {
	const path = firstString(input.path, input.filePath, input.file_path);
	if (path) {
		return basename(normalizePath(path));
	}

	return firstString(input.subsystem, input.query, input.context);
};

export const prepareSrclightToolInput = (
	toolName: string,
	input: Record<string, unknown>,
): Record<string, unknown> => {
	if (emptyInputToolNames.has(toolName)) {
		return {};
	}

	if (toolName === "symbols_in_file") {
		const path = firstString(input.path, input.file_path, input.filePath, input.uri);
		return path ? { path } : input;
	}

	if (
		toolName === "search_symbols" ||
		toolName === "semantic_search" ||
		toolName === "hybrid_search"
	) {
		const query = firstString(input.query, input.search_text, input.symbol, input.name);
		return query
			? {
					query,
					...(typeof input.limit === "number" ? { limit: input.limit } : {}),
					...(typeof input.max_results === "number" ? { limit: input.max_results } : {}),
					...(typeof input.kind === "string" ? { kind: input.kind } : {}),
					...(typeof input.project === "string" ? { project: input.project } : {}),
				}
			: input;
	}

	if (
		toolName === "get_symbol" ||
		toolName === "get_signature" ||
		toolName === "get_type_hierarchy"
	) {
		const name = firstString(input.name, input.symbol, input.identifier, input.query);
		return name
			? {
					name,
					...(typeof input.project === "string" ? { project: input.project } : {}),
				}
			: input;
	}

	if (
		toolName === "get_callers" ||
		toolName === "get_callees" ||
		toolName === "get_dependents" ||
		toolName === "get_tests_for" ||
		toolName === "blame_symbol" ||
		toolName === "changes_to" ||
		toolName === "get_platform_variants"
	) {
		const symbol_name = firstString(
			input.symbol_name,
			input.symbol,
			input.name,
			input.identifier,
			input.query,
		);
		return symbol_name
			? {
					symbol_name,
					...(typeof input.project === "string" ? { project: input.project } : {}),
					...(typeof input.transitive === "boolean" ? { transitive: input.transitive } : {}),
				}
			: input;
	}

	if (toolName === "get_implementors") {
		const interface_name = firstString(
			input.interface_name,
			input.interfaceName,
			input.symbol,
			input.name,
			input.identifier,
			input.query,
		);
		return interface_name
			? {
					interface_name,
					...(typeof input.project === "string" ? { project: input.project } : {}),
				}
			: input;
	}

	return input;
};

const executeRoutes = async (
	context: UnifiedExecutionContext,
	routes: Array<{ route: UnifiedRoute; args: Record<string, unknown> }>,
): Promise<UnifiedExecutionStep[]> => {
	const fallbackOnly = routes.every(({ route }) => route.executionStrategy === "fallback-only");
	if (fallbackOnly) {
		const steps: UnifiedExecutionStep[] = [];
		for (const { route, args } of routes) {
			const startedAt = performance.now();
			const response = await context.invoke(route.engineTool, args);
			const step = {
				route,
				response,
				latencyMs: Math.round(performance.now() - startedAt),
			};
			steps.push(step);
			if (response.ok) {
				break;
			}
		}
		return steps;
	}

	return Promise.all(
		routes.map(async ({ route, args }) => {
			const startedAt = performance.now();
			const response = await context.invoke(route.engineTool, args);

			return {
				route,
				response,
				latencyMs: Math.round(performance.now() - startedAt),
			};
		}),
	);
};

export const resolveSrclightRoutes = (tools: EngineDiscoveredTool[]): UnifiedRoute[] =>
	resolveRoutesFromPatterns("srclight", tools, srclightRoutingRules);

const routeByTool = (routes: UnifiedRoute[], toolName: string): UnifiedRoute | undefined =>
	routes.find((route) => route.engineTool === toolName);

const candidateSteps = (
	context: UnifiedExecutionContext,
	candidates: Array<[string, Record<string, unknown> | null]>,
): Array<{ route: UnifiedRoute; args: Record<string, unknown> }> =>
	candidates
		.map(([toolName, args]) => {
			const route = routeByTool(context.routes, toolName);
			if (!route || !args) {
				return null;
			}

			return {
				route,
				args: prepareSrclightToolInput(toolName, args),
			};
		})
		.filter((entry): entry is { route: UnifiedRoute; args: Record<string, unknown> } =>
			Boolean(entry),
		);

export const executeSrclightUnifiedTool = async (
	context: UnifiedExecutionContext,
): Promise<UnifiedExecutionStep[] | null> => {
	const query = firstString(context.input.query, context.input.search_text, context.input.prompt);
	const path = firstString(context.input.path, context.input.filePath, context.input.file_path);
	const limit = firstNumber(context.input.limit, context.input.max_results);
	const symbol = symbolLikeValue(context.input);

	switch (context.unifiedTool) {
		case "explain_project": {
			const preferred = context.routes.filter((route) => /codebase_map/i.test(route.engineTool));
			const selected = preferred.length > 0 ? preferred : context.routes.slice(0, 1);
			return executeRoutes(
				context,
				selected.map((route) => ({ route, args: {} })),
			);
		}
		case "explain_subsystem": {
			const label = subsystemLabel(context.input);
			return executeRoutes(
				context,
				candidateSteps(context, [
					[
						"search_symbols",
						label
							? {
									query: label,
									...(limit ? { limit } : {}),
								}
							: null,
					],
					[
						"get_symbol",
						isLikelyIdentifier(label)
							? {
									name: label,
								}
							: null,
					],
					[
						"symbols_in_file",
						path && isLikelyFilePath(path)
							? {
									path,
								}
							: null,
					],
				]),
			);
		}
		case "find_symbol":
			return executeRoutes(
				context,
				candidateSteps(context, [
					[
						"search_symbols",
						query
							? {
									query,
									...(limit ? { limit } : {}),
								}
							: null,
					],
					[
						"get_symbol",
						isLikelyIdentifier(symbol)
							? {
									name: symbol,
								}
							: null,
					],
					[
						"get_signature",
						isLikelyIdentifier(symbol)
							? {
									name: symbol,
								}
							: null,
					],
				]),
			);
		case "find_tests":
			return executeRoutes(
				context,
				candidateSteps(context, [
					[
						"get_tests_for",
						isLikelyIdentifier(symbol)
							? {
									symbol_name: symbol,
								}
							: null,
					],
				]),
			);
		case "inspect_type_hierarchy":
			return executeRoutes(
				context,
				candidateSteps(context, [
					[
						"get_type_hierarchy",
						isLikelyIdentifier(symbol)
							? {
									name: symbol,
								}
							: null,
					],
				]),
			);
		case "inspect_platform_code":
			return executeRoutes(
				context,
				candidateSteps(context, [
					[
						"get_platform_variants",
						isLikelyIdentifier(symbol)
							? {
									symbol_name: symbol,
								}
							: null,
					],
					["platform_conditionals", isLikelyIdentifier(symbol) ? null : {}],
				]),
			);
		case "list_workspace_projects":
			return executeRoutes(context, candidateSteps(context, [["list_projects", {}]]));
		case "refresh_index":
			return executeRoutes(context, candidateSteps(context, [["reindex", {}]]));
		case "search_code":
			return executeRoutes(
				context,
				candidateSteps(context, [
					[
						"hybrid_search",
						query
							? {
									query,
									...(limit ? { limit } : {}),
								}
							: null,
					],
					[
						"semantic_search",
						query
							? {
									query,
									...(limit ? { limit } : {}),
								}
							: null,
					],
				]),
			);
		case "trace_dependency":
			return executeRoutes(
				context,
				candidateSteps(context, [
					[
						"get_callers",
						isLikelyIdentifier(symbol)
							? {
									symbol_name: symbol,
								}
							: null,
					],
					[
						"get_callees",
						isLikelyIdentifier(symbol)
							? {
									symbol_name: symbol,
								}
							: null,
					],
					[
						"get_dependents",
						isLikelyIdentifier(symbol)
							? {
									symbol_name: symbol,
									...(typeof context.input.transitive === "boolean"
										? { transitive: context.input.transitive }
										: {}),
								}
							: null,
					],
				]),
			);
		case "trace_integration":
			return executeRoutes(
				context,
				candidateSteps(context, [
					["get_build_targets", {}],
					[
						"get_dependents",
						isLikelyIdentifier(symbol)
							? {
									symbol_name: symbol,
								}
							: null,
					],
					[
						"get_implementors",
						isLikelyIdentifier(symbol)
							? {
									interface_name: symbol,
								}
							: null,
					],
				]),
			);
		case "investigate_issue":
			return executeRoutes(
				context,
				candidateSteps(context, [
					["recent_changes", {}],
					["whats_changed", {}],
					[
						"hybrid_search",
						query
							? {
									query,
									...(limit ? { limit } : {}),
								}
							: null,
					],
					[
						"blame_symbol",
						isLikelyIdentifier(symbol)
							? {
									symbol_name: symbol,
								}
							: null,
					],
					[
						"changes_to",
						isLikelyIdentifier(symbol)
							? {
									symbol_name: symbol,
								}
							: null,
					],
				]),
			);
		case "evaluate_codebase":
			return executeRoutes(
				context,
				context.routes.map((route) => ({
					route,
					args: prepareSrclightToolInput(route.engineTool, context.input),
				})),
			);
		default:
			return null;
	}
};
