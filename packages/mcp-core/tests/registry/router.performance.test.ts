import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createDefaultConfig } from "@mimirmesh/config";
import { persistConnection, persistRoutingTable, type RoutingTable } from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";

import { createToolRouter } from "../../src/registry/router";

const verboseDescription = (engine: string, tool: string) =>
	[
		`${engine} ${tool} provides a detailed repository intelligence capability with explicit parameter guidance, result interpretation hints, and operator-facing usage notes.`,
		"Use this when you need scoped retrieval without falling back to broader architecture analysis, and prefer it over approximate search when a concrete symbol or document target is available.",
	].join(" ");

const largeInputSchema = {
	type: "object",
	properties: {
		query: {
			type: "string",
			description:
				"The precise search text, symbol, or natural-language task description to evaluate.",
		},
		path: {
			type: "string",
			description: "Optional repository-relative path scope used to narrow the search surface.",
		},
		limit: {
			type: "number",
			description: "Maximum number of ranked results to return for this inspection request.",
		},
		includeTests: {
			type: "boolean",
			description: "Whether matching tests should be included in the response payload.",
		},
	},
	required: ["query"],
};

const buildRoutingTable = (): RoutingTable => ({
	generatedAt: new Date().toISOString(),
	passthrough: [
		{
			publicTool: "mimirmesh.srclight.search_symbols",
			engine: "srclight",
			engineTool: "search_symbols",
			description: verboseDescription("srclight", "search_symbols"),
			inputSchema: largeInputSchema,
			publication: {
				canonicalEngineId: "srclight",
				publishedTool: "srclight_search_symbols",
				retiredAliases: ["mimirmesh.srclight.search_symbols"],
			},
		},
		{
			publicTool: "mimirmesh.srclight.hybrid_search",
			engine: "srclight",
			engineTool: "hybrid_search",
			description: verboseDescription("srclight", "hybrid_search"),
			inputSchema: largeInputSchema,
			publication: {
				canonicalEngineId: "srclight",
				publishedTool: "srclight_hybrid_search",
				retiredAliases: ["mimirmesh.srclight.hybrid_search"],
			},
		},
		{
			publicTool: "mimirmesh.docs.search_documents",
			engine: "document-mcp",
			engineTool: "search_documents",
			description: verboseDescription("document-mcp", "search_documents"),
			inputSchema: largeInputSchema,
			publication: {
				canonicalEngineId: "docs",
				publishedTool: "docs_search_documents",
				retiredAliases: ["mimirmesh.docs.search_documents"],
			},
		},
		{
			publicTool: "mimirmesh.docs.get_document_info",
			engine: "document-mcp",
			engineTool: "get_document_info",
			description: verboseDescription("document-mcp", "get_document_info"),
			inputSchema: largeInputSchema,
			publication: {
				canonicalEngineId: "docs",
				publishedTool: "docs_get_document_info",
				retiredAliases: ["mimirmesh.docs.get_document_info"],
			},
		},
		{
			publicTool: "mimirmesh.adr.document_architecture",
			engine: "mcp-adr-analysis-server",
			engineTool: "document_architecture",
			description: verboseDescription("adr", "document_architecture"),
			inputSchema: largeInputSchema,
			publication: {
				canonicalEngineId: "adr",
				publishedTool: "adr_document_architecture",
				retiredAliases: ["mimirmesh.adr.document_architecture"],
			},
		},
		{
			publicTool: "mimirmesh.adr.trace_integration",
			engine: "mcp-adr-analysis-server",
			engineTool: "trace_integration",
			description: verboseDescription("adr", "trace_integration"),
			inputSchema: largeInputSchema,
			publication: {
				canonicalEngineId: "adr",
				publishedTool: "adr_trace_integration",
				retiredAliases: ["mimirmesh.adr.trace_integration"],
			},
		},
		{
			publicTool: "mimirmesh.srclight.get_callers",
			engine: "srclight",
			engineTool: "get_callers",
			description: verboseDescription("srclight", "get_callers"),
			inputSchema: largeInputSchema,
			publication: {
				canonicalEngineId: "srclight",
				publishedTool: "srclight_get_callers",
				retiredAliases: ["mimirmesh.srclight.get_callers"],
			},
		},
		{
			publicTool: "mimirmesh.docs.search_graph",
			engine: "document-mcp",
			engineTool: "search_graph",
			description: verboseDescription("document-mcp", "search_graph"),
			inputSchema: largeInputSchema,
			publication: {
				canonicalEngineId: "docs",
				publishedTool: "docs_search_graph",
				retiredAliases: ["mimirmesh.docs.search_graph"],
			},
		},
		{
			publicTool: "mimirmesh.adr.generate_adr",
			engine: "mcp-adr-analysis-server",
			engineTool: "generate_adr",
			description: verboseDescription("adr", "generate_adr"),
			inputSchema: largeInputSchema,
			publication: {
				canonicalEngineId: "adr",
				publishedTool: "adr_generate_adr",
				retiredAliases: ["mimirmesh.adr.generate_adr"],
			},
		},
	],
	unified: [],
});

afterEach(() => {
	delete process.env.MIMIRMESH_SESSION_ID;
});

describe("mcp tool router performance", () => {
	test("keeps the default surface at least 35% smaller than an eager passthrough baseline", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);
		const routingTable = buildRoutingTable();

		try {
			await persistConnection(repo, {
				projectName: config.runtime.projectName,
				composeFile: config.runtime.composeFile,
				updatedAt: new Date().toISOString(),
				startedAt: new Date().toISOString(),
				mounts: {
					repository: repo,
					mimirmesh: `${repo}/.mimirmesh`,
				},
				services: ["mm-srclight", "mm-document-mcp", "mm-adr-analysis"],
				bridgePorts: {
					srclight: 65530,
					"document-mcp": 65531,
					"mcp-adr-analysis-server": 65532,
				},
			});
			await persistRoutingTable(repo, routingTable);

			const eagerConfig = createDefaultConfig(repo);
			eagerConfig.mcp.toolSurface.coreEngineGroups = [
				"srclight",
				"document-mcp",
				"mcp-adr-analysis-server",
			];
			eagerConfig.mcp.toolSurface.deferredEngineGroups = [];
			const eagerRouter = createToolRouter({
				projectRoot: repo,
				config: eagerConfig,
				sessionId: "performance-eager-default",
			});
			const eagerTools = await eagerRouter.listTools();

			const router = createToolRouter({
				projectRoot: repo,
				config,
				sessionId: "performance-default",
			});
			const tools = await router.listTools();
			const currentBytes = JSON.stringify(tools).length;
			const baselineBytes = JSON.stringify(eagerTools).length;
			const reduction = 1 - currentBytes / baselineBytes;

			expect(reduction).toBeGreaterThanOrEqual(0.35);
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});

	test("keeps post-load session cost lower than the eager baseline and compresses per-tool schema by 40%", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);
		const routingTable = buildRoutingTable();

		try {
			await persistConnection(repo, {
				projectName: config.runtime.projectName,
				composeFile: config.runtime.composeFile,
				updatedAt: new Date().toISOString(),
				startedAt: new Date().toISOString(),
				mounts: {
					repository: repo,
					mimirmesh: `${repo}/.mimirmesh`,
				},
				services: ["mm-srclight", "mm-document-mcp", "mm-adr-analysis"],
				bridgePorts: {
					srclight: 65530,
					"document-mcp": 65531,
					"mcp-adr-analysis-server": 65532,
				},
			});
			await persistRoutingTable(repo, routingTable);

			process.env.MIMIRMESH_SESSION_ID = "performance-loaded";
			const eagerConfig = createDefaultConfig(repo);
			eagerConfig.mcp.toolSurface.coreEngineGroups = [
				"srclight",
				"document-mcp",
				"mcp-adr-analysis-server",
			];
			eagerConfig.mcp.toolSurface.deferredEngineGroups = [];

			const eagerRouter = createToolRouter({
				projectRoot: repo,
				config: eagerConfig,
				sessionId: "performance-eager",
			});
			const eagerTools = await eagerRouter.listTools();
			const eagerBytes = JSON.stringify(eagerTools).length;

			const partiallyLoadedConfig = createDefaultConfig(repo);
			partiallyLoadedConfig.mcp.toolSurface.coreEngineGroups = ["srclight"];
			partiallyLoadedConfig.mcp.toolSurface.deferredEngineGroups = [
				"document-mcp",
				"mcp-adr-analysis-server",
			];
			const router = createToolRouter({
				projectRoot: repo,
				config: partiallyLoadedConfig,
				sessionId: "performance-loaded",
			});
			const loadedTools = await router.listTools();
			const loadedBytes = JSON.stringify(loadedTools).length;

			const compressedSchema = await router.inspectToolSchema(
				"srclight_search_symbols",
				"compressed",
			);
			const fullSchema = await router.inspectToolSchema("srclight_search_symbols", "full");
			const schemaReduction =
				1 -
				JSON.stringify(compressedSchema.schemaPayload).length /
					JSON.stringify(fullSchema.schemaPayload).length;

			expect(loadedBytes).toBeLessThan(eagerBytes);
			expect(schemaReduction).toBeGreaterThanOrEqual(0.4);
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});
});
