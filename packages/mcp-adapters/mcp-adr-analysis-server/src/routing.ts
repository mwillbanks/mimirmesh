import type { MimirmeshConfig } from "@mimirmesh/config";
import type { EngineDiscoveredTool, UnifiedRoute } from "@mimirmesh/runtime";
import type {
	AdapterRoutingRule,
	UnifiedExecutionContext,
	UnifiedExecutionStep,
} from "../../src/types";
import { resolveRoutesFromPatterns } from "../../src/utils";
import { resolveAdrDirectory } from "./config";
import type { AdrSettings } from "./types";

export const adrRoutingRules: AdapterRoutingRule[] = [
	{
		unifiedTool: "document_architecture",
		candidateToolPatterns: [/^get_architectural_context$/i, /^analyze_project_ecosystem$/i],
		priority: 110,
	},
	{
		unifiedTool: "generate_adr",
		candidateToolPatterns: [
			/^suggest_adrs$/i,
			/^generate_adr_from_decision$/i,
			/^generate_adrs_from_prd$/i,
		],
		priority: 100,
	},
	{
		unifiedTool: "trace_integration",
		candidateToolPatterns: [
			/^analyze_project_ecosystem$/i,
			/^analyze_deployment_progress$/i,
			/^generate_deployment_guidance$/i,
		],
		priority: 80,
	},
	{
		unifiedTool: "evaluate_codebase",
		candidateToolPatterns: [
			/^analyze_project_ecosystem$/i,
			/^analyze_environment$/i,
			/^analyze_gaps$/i,
		],
		priority: 70,
	},
];

export const resolveAdrRoutes = (tools: EngineDiscoveredTool[]): UnifiedRoute[] =>
	resolveRoutesFromPatterns("mcp-adr-analysis-server", tools, adrRoutingRules);

const schemaHasProperty = (
	inputSchema: Record<string, unknown> | undefined,
	property: string,
): boolean => {
	const properties = inputSchema?.properties;
	return typeof properties === "object" && properties !== null && property in properties;
};

export const prepareAdrToolInput = (
	input: Record<string, unknown>,
	options: {
		projectRoot: string;
		config: MimirmeshConfig;
		inputSchema?: Record<string, unknown>;
	},
): Record<string, unknown> => {
	const prepared = { ...input };
	const settings = options.config.engines["mcp-adr-analysis-server"].settings as AdrSettings;
	const adrDirectory = resolveAdrDirectory(options.projectRoot, settings);

	if (schemaHasProperty(options.inputSchema, "adrDirectory") && prepared.adrDirectory == null) {
		prepared.adrDirectory = adrDirectory;
	}

	if (
		schemaHasProperty(options.inputSchema, "outputDirectory") &&
		prepared.outputDirectory == null
	) {
		prepared.outputDirectory = adrDirectory;
	}

	if (schemaHasProperty(options.inputSchema, "projectPath") && prepared.projectPath == null) {
		prepared.projectPath = settings.projectPath;
	}

	return prepared;
};

const firstString = (...values: unknown[]): string => {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}
	return "";
};

const asConversationContext = (
	input: Record<string, unknown>,
): Record<string, unknown> | undefined => {
	const existing = input.conversationContext;
	if (typeof existing === "object" && existing !== null) {
		return existing as Record<string, unknown>;
	}

	const humanRequest =
		typeof input.query === "string"
			? input.query.trim()
			: typeof input.prompt === "string"
				? input.prompt.trim()
				: "";
	if (!humanRequest) {
		return undefined;
	}

	return {
		humanRequest,
		focusAreas: ["architecture"],
	};
};

const executeRoute = async (
	context: UnifiedExecutionContext,
	route: UnifiedRoute,
	args: Record<string, unknown>,
): Promise<UnifiedExecutionStep> => {
	const startedAt = performance.now();
	const response = await context.invoke(route.engineTool, args);

	return {
		route,
		response,
		latencyMs: Math.round(performance.now() - startedAt),
	};
};

const routeByTool = (routes: UnifiedRoute[], toolName: string): UnifiedRoute | undefined =>
	routes.find((route) => route.engineTool === toolName);

const adrDefaults = (
	projectRoot: string,
	config: MimirmeshConfig,
): { adrDirectory: string; projectPath: string } => {
	const settings = config.engines["mcp-adr-analysis-server"].settings as AdrSettings;
	return {
		adrDirectory: resolveAdrDirectory(projectRoot, settings),
		projectPath: settings.projectPath,
	};
};

export const executeAdrUnifiedTool = async (
	context: UnifiedExecutionContext,
): Promise<UnifiedExecutionStep[] | null> => {
	const defaults = adrDefaults(context.projectRoot, context.config);
	const conversationContext = asConversationContext(context.input);

	switch (context.unifiedTool) {
		case "document_architecture": {
			const preferredRoute =
				routeByTool(context.routes, "get_architectural_context") ??
				routeByTool(context.routes, "analyze_project_ecosystem");
			if (!preferredRoute) {
				return [];
			}

			if (preferredRoute.engineTool === "get_architectural_context") {
				return [
					await executeRoute(context, preferredRoute, {
						...(typeof context.input.filePath === "string"
							? { filePath: context.input.filePath }
							: typeof context.input.path === "string"
								? { filePath: context.input.path }
								: {}),
						includeCompliance:
							typeof context.input.includeCompliance === "boolean"
								? context.input.includeCompliance
								: true,
						...(conversationContext ? { conversationContext } : {}),
					}),
				];
			}

			return [
				await executeRoute(context, preferredRoute, {
					projectPath:
						typeof context.input.projectPath === "string"
							? context.input.projectPath
							: defaults.projectPath,
					analysisDepth:
						typeof context.input.analysisDepth === "string"
							? context.input.analysisDepth
							: "comprehensive",
					includeEnvironment:
						typeof context.input.includeEnvironment === "boolean"
							? context.input.includeEnvironment
							: true,
					recursiveDepth:
						typeof context.input.recursiveDepth === "string"
							? context.input.recursiveDepth
							: "comprehensive",
					...(conversationContext ? { conversationContext } : {}),
				}),
			];
		}
		case "generate_adr": {
			const prdRoute = routeByTool(context.routes, "generate_adrs_from_prd");
			if (prdRoute && typeof context.input.prdPath === "string") {
				return [
					await executeRoute(context, prdRoute, {
						prdPath: context.input.prdPath,
						outputDirectory: defaults.adrDirectory,
						...(conversationContext ? { conversationContext } : {}),
					}),
				];
			}

			const decisionRoute = routeByTool(context.routes, "generate_adr_from_decision");
			if (
				decisionRoute &&
				typeof context.input.decisionData === "object" &&
				context.input.decisionData !== null
			) {
				return [
					await executeRoute(context, decisionRoute, {
						decisionData: context.input.decisionData,
						adrDirectory: defaults.adrDirectory,
					}),
				];
			}

			const suggestRoute = routeByTool(context.routes, "suggest_adrs");
			if (!suggestRoute) {
				return [];
			}

			return [
				await executeRoute(context, suggestRoute, {
					projectPath:
						typeof context.input.projectPath === "string"
							? context.input.projectPath
							: defaults.projectPath,
					analysisType:
						typeof context.input.analysisType === "string"
							? context.input.analysisType
							: "comprehensive",
					...(conversationContext ? { conversationContext } : {}),
				}),
			];
		}
		case "trace_integration": {
			const steps: UnifiedExecutionStep[] = [];
			const ecosystemRoute = routeByTool(context.routes, "analyze_project_ecosystem");
			if (ecosystemRoute) {
				steps.push(
					await executeRoute(context, ecosystemRoute, {
						projectPath:
							typeof context.input.projectPath === "string"
								? context.input.projectPath
								: defaults.projectPath,
						analysisDepth:
							typeof context.input.analysisDepth === "string"
								? context.input.analysisDepth
								: "detailed",
						includeEnvironment:
							typeof context.input.includeEnvironment === "boolean"
								? context.input.includeEnvironment
								: true,
						recursiveDepth:
							typeof context.input.recursiveDepth === "string"
								? context.input.recursiveDepth
								: "deep",
						...(conversationContext ? { conversationContext } : {}),
					}),
				);
			}

			const guidanceRoute = routeByTool(context.routes, "generate_deployment_guidance");
			if (guidanceRoute) {
				steps.push(
					await executeRoute(context, guidanceRoute, {
						adrDirectory: defaults.adrDirectory,
						projectPath:
							typeof context.input.projectPath === "string"
								? context.input.projectPath
								: defaults.projectPath,
						environment:
							typeof context.input.environment === "string"
								? context.input.environment
								: "production",
						format: "markdown",
					}),
				);
			}

			const progressRoute = routeByTool(context.routes, "analyze_deployment_progress");
			if (progressRoute) {
				steps.push(
					await executeRoute(context, progressRoute, {
						analysisType:
							typeof context.input.analysisType === "string" ? context.input.analysisType : "tasks",
						adrDirectory: defaults.adrDirectory,
						todoPath: firstString(context.input.todoPath) || "TODO.md",
					}),
				);
			}

			return steps;
		}
		default:
			return null;
	}
};
