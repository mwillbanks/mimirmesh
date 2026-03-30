import { z } from "zod";
import type { UnifiedToolName } from "../types";
import { skillsToolDescriptions, skillsToolInputSchemas } from "./skills-tools";

type UnifiedToolSchema = Record<string, z.ZodTypeAny>;

type UnifiedToolDefinition = {
	description: string;
	inputSchema: UnifiedToolSchema;
};

const optionalText = (description: string) =>
	z.string().trim().min(1).optional().describe(description);

const optionalLimit = (description: string) =>
	z.number().int().positive().optional().describe(description);

const humanQuerySchema = {
	query: optionalText("Human-readable request or search text."),
	context: optionalText("Optional extra context that refines the request."),
};

export const unifiedToolDefinitions: Record<UnifiedToolName, UnifiedToolDefinition> = {
	"skills.find": {
		description: skillsToolDescriptions["skills.find"],
		inputSchema: skillsToolInputSchemas["skills.find"],
	},
	"skills.read": {
		description: skillsToolDescriptions["skills.read"],
		inputSchema: skillsToolInputSchemas["skills.read"],
	},
	"skills.resolve": {
		description: skillsToolDescriptions["skills.resolve"],
		inputSchema: skillsToolInputSchemas["skills.resolve"],
	},
	"skills.refresh": {
		description: skillsToolDescriptions["skills.refresh"],
		inputSchema: skillsToolInputSchemas["skills.refresh"],
	},
	"skills.create": {
		description: skillsToolDescriptions["skills.create"],
		inputSchema: skillsToolInputSchemas["skills.create"],
	},
	"skills.update": {
		description: skillsToolDescriptions["skills.update"],
		inputSchema: skillsToolInputSchemas["skills.update"],
	},
	explain_project: {
		description: "Summarize repository architecture, boundaries, and operating model.",
		inputSchema: {
			...humanQuerySchema,
			path: optionalText("Optional repository path or module path to focus the summary."),
		},
	},
	explain_subsystem: {
		description: "Explain a subsystem's design and responsibilities.",
		inputSchema: {
			subsystem: optionalText("Subsystem, package, module, or component name."),
			path: optionalText("Optional file or directory path for the subsystem."),
			...humanQuerySchema,
			limit: optionalLimit("Maximum number of supporting results to include."),
		},
	},
	find_symbol: {
		description: "Locate a named symbol, declaration, or signature in source files.",
		inputSchema: {
			query: optionalText("Symbol name, identifier, or code reference to locate."),
			path: optionalText("Optional file or directory path to narrow the search."),
			limit: optionalLimit("Maximum number of symbol matches to return."),
		},
	},
	find_tests: {
		description: "Find tests related to a symbol or behavior.",
		inputSchema: {
			query: optionalText("Symbol name to find tests for."),
			path: optionalText("Optional file or directory path to narrow the search."),
		},
	},
	inspect_type_hierarchy: {
		description: "Inspect the inheritance hierarchy for a type.",
		inputSchema: {
			query: optionalText("Class, interface, or struct name to inspect."),
			path: optionalText("Optional file or directory path to narrow the search."),
		},
	},
	inspect_platform_code: {
		description: "Inspect platform-specific variants or conditional code paths.",
		inputSchema: {
			query: optionalText("Optional symbol name to inspect for platform variants."),
			path: optionalText("Optional file or directory path to narrow the search."),
		},
	},
	list_workspace_projects: {
		description: "List indexed workspace projects and their current stats.",
		inputSchema: {},
	},
	refresh_index: {
		description: "Trigger an incremental refresh of the active code index.",
		inputSchema: {
			path: optionalText("Optional subpath to refresh instead of the whole repository."),
		},
	},
	search_code: {
		description: "Search source code by text, snippet, import, or pattern.",
		inputSchema: {
			query: optionalText("Text, identifier, or phrase to search for."),
			path: optionalText("Optional file path or glob-like scope hint."),
			kind: optionalText(
				"Optional symbol kind hint such as function, class, method, interface, or command.",
			),
			limit: optionalLimit("Maximum number of matches to return."),
		},
	},
	search_docs: {
		description: "Search repository docs, ADRs, specs, and runbooks.",
		inputSchema: {
			query: optionalText("Documentation topic, phrase, or question."),
			scope: optionalText("Optional scope such as documents or chunks."),
			limit: optionalLimit("Maximum number of documentation matches to return."),
		},
	},
	trace_dependency: {
		description: "Trace callers, callees, or dependents for a symbol or module.",
		inputSchema: {
			query: optionalText("Symbol, function, or module to trace."),
			path: optionalText("Optional file or module path to scope the trace."),
			direction: z
				.enum(["inbound", "outbound", "both"])
				.optional()
				.describe("Dependency traversal direction."),
			depth: z.number().int().positive().max(5).optional().describe("Maximum trace depth."),
		},
	},
	trace_integration: {
		description: "Trace integrations, deployment topology, CI/CD, and external systems.",
		inputSchema: {
			...humanQuerySchema,
			path: optionalText("Optional file or directory path to scope the analysis."),
			environment: optionalText("Optional target environment such as development or production."),
		},
	},
	investigate_issue: {
		description: "Investigate a bug, regression, or failure with routed evidence.",
		inputSchema: {
			query: optionalText("Issue description, symptom, or failure message."),
			path: optionalText("Optional file or directory path to scope the investigation."),
			context: optionalText("Optional extra context such as reproduction details."),
		},
	},
	evaluate_codebase: {
		description: "Assess maintainability, architectural quality, and systemic risk.",
		inputSchema: {
			...humanQuerySchema,
			path: optionalText("Optional file or directory path to focus the evaluation."),
		},
	},
	generate_adr: {
		description: "Generate ADR analysis for an architecture decision or PRD.",
		inputSchema: {
			...humanQuerySchema,
			decision: optionalText(
				"Concrete architecture decision or proposed change to capture when you are not supplying a PRD.",
			),
			prdPath: optionalText("Optional PRD path when generating ADRs from a PRD."),
			path: optionalText("Optional file or directory path for supporting context."),
		},
	},
	document_feature: {
		description: "Generate feature documentation from project context.",
		inputSchema: {
			...humanQuerySchema,
			path: optionalText("Optional feature file or directory path."),
		},
	},
	document_architecture: {
		description: "Retrieve or synthesize architecture documentation from project context.",
		inputSchema: {
			...humanQuerySchema,
			path: optionalText("Optional architecture file or directory path."),
			limit: optionalLimit("Maximum number of supporting documentation matches to include."),
		},
	},
	document_runbook: {
		description: "Generate operational runbooks from project context.",
		inputSchema: {
			...humanQuerySchema,
			path: optionalText("Optional service or runbook path."),
		},
	},
	runtime_status: {
		description: "Return runtime health and engine availability.",
		inputSchema: {},
	},
	config_get: {
		description: "Read project-local MímirMesh config values.",
		inputSchema: {
			path: optionalText("Optional dotted config path."),
		},
	},
	config_set: {
		description: "Set project-local MímirMesh config values.",
		inputSchema: {
			path: z.string().trim().min(1).describe("Dotted config path to update."),
			value: z.any().optional().describe("Value to write at the config path."),
		},
	},
	load_deferred_tools: {
		description: "Load a deferred engine group into the current MCP session.",
		inputSchema: {
			engine: z
				.enum(["srclight", "document-mcp", "mcp-adr-analysis-server"])
				.describe("Deferred engine group to load into the current session."),
		},
	},
	refresh_tool_surface: {
		description: "Refresh loaded deferred engine groups in the current MCP session.",
		inputSchema: {
			engine: z
				.enum(["srclight", "document-mcp", "mcp-adr-analysis-server"])
				.optional()
				.describe("Optional engine group to refresh instead of all loaded groups."),
		},
	},
	inspect_tool_schema: {
		description: "Inspect compressed or full schema detail for a visible tool.",
		inputSchema: {
			toolName: z.string().trim().min(1).describe("Visible tool name to inspect."),
			view: z
				.enum(["compressed", "full", "debug"])
				.optional()
				.describe("Schema detail level to return."),
		},
	},
	inspect_route_hints: {
		description:
			"Inspect route-hint ordering, confidence, freshness, subset eligibility, and telemetry maintenance status.",
		inputSchema: {
			unifiedTool: z
				.enum([
					"explain_project",
					"explain_subsystem",
					"find_symbol",
					"find_tests",
					"inspect_type_hierarchy",
					"inspect_platform_code",
					"list_workspace_projects",
					"refresh_index",
					"search_code",
					"search_docs",
					"trace_dependency",
					"trace_integration",
					"investigate_issue",
					"evaluate_codebase",
					"generate_adr",
					"document_feature",
					"document_architecture",
					"document_runbook",
				])
				.optional()
				.describe("Optional unified tool to inspect."),
			engine: z
				.enum(["srclight", "document-mcp", "mcp-adr-analysis-server"])
				.optional()
				.describe("Optional engine to narrow the inspected route."),
			engineTool: optionalText("Optional concrete engine tool name."),
			profile: optionalText("Optional explicit route profile key."),
			includeRollups: z
				.boolean()
				.optional()
				.describe("Whether to include recent 15m/6h/1d rollups."),
			limitBuckets: z
				.number()
				.int()
				.positive()
				.max(32)
				.optional()
				.describe("Maximum number of buckets to return per rollup tier."),
		},
	},
};

export const unifiedToolDescriptions: Record<UnifiedToolName, string> = Object.fromEntries(
	Object.entries(unifiedToolDefinitions).map(([name, definition]) => [
		name,
		definition.description,
	]),
) as Record<UnifiedToolName, string>;

export const unifiedToolInputSchemas: Record<UnifiedToolName, UnifiedToolSchema> =
	Object.fromEntries(
		Object.entries(unifiedToolDefinitions).map(([name, definition]) => [
			name,
			definition.inputSchema,
		]),
	) as Record<UnifiedToolName, UnifiedToolSchema>;

export const unifiedToolList = Object.entries(unifiedToolDefinitions).map(([name, definition]) => ({
	name: name as UnifiedToolName,
	description: definition.description,
}));

export const isUnifiedTool = (name: string): name is UnifiedToolName =>
	Object.hasOwn(unifiedToolDefinitions, name);
