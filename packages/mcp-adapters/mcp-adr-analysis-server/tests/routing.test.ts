import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createDefaultConfig } from "@mimirmesh/config";

import { executeAdrUnifiedTool, prepareAdrToolInput, resolveAdrRoutes } from "../src/routing";

describe("adr-analysis unified routing", () => {
	test("maps document_architecture to live architecture tools", () => {
		const routes = resolveAdrRoutes([
			{ name: "get_architectural_context" },
			{ name: "analyze_project_ecosystem" },
			{ name: "suggest_adrs" },
			{ name: "discover_existing_adrs" },
		]);

		expect(routes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					unifiedTool: "document_architecture",
					engineTool: "get_architectural_context",
				}),
				expect.objectContaining({
					unifiedTool: "document_architecture",
					engineTool: "analyze_project_ecosystem",
				}),
				expect.objectContaining({
					unifiedTool: "generate_adr",
					engineTool: "suggest_adrs",
				}),
			]),
		);
	});

	test("executes get_architectural_context for unified document_architecture", async () => {
		const config = createDefaultConfig("/tmp/adr-architecture");
		const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];

		const results = await executeAdrUnifiedTool({
			unifiedTool: "document_architecture",
			routes: [
				{
					unifiedTool: "document_architecture",
					engine: "mcp-adr-analysis-server",
					engineTool: "get_architectural_context",
					priority: 110,
				},
			],
			input: {},
			projectRoot: "/tmp/adr-architecture",
			config,
			bridgePorts: {},
			invoke: async (tool, args) => {
				calls.push({ tool, args });
				return { ok: true, result: { content: [{ text: "Architecture summary" }] } };
			},
		});

		expect(calls).toHaveLength(1);
		expect(calls[0]).toEqual({
			tool: "get_architectural_context",
			args: {
				includeCompliance: true,
			},
		});
		expect(results).toHaveLength(1);
		expect(results?.[0]?.route.engineTool).toBe("get_architectural_context");
	});

	test("uses suggest_adrs for unified generate_adr without a PRD path", async () => {
		const config = createDefaultConfig("/tmp/adr-generate");
		const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];

		const results = await executeAdrUnifiedTool({
			unifiedTool: "generate_adr",
			routes: [
				{
					unifiedTool: "generate_adr",
					engine: "mcp-adr-analysis-server",
					engineTool: "suggest_adrs",
					priority: 100,
				},
				{
					unifiedTool: "generate_adr",
					engine: "mcp-adr-analysis-server",
					engineTool: "generate_adrs_from_prd",
					priority: 90,
				},
			],
			input: { query: "canonical ADR directory" },
			projectRoot: "/tmp/adr-generate",
			config,
			bridgePorts: {},
			invoke: async (tool, args) => {
				calls.push({ tool, args });
				return { ok: true, result: { content: [{ text: "ADR suggestions" }] } };
			},
		});

		expect(calls).toEqual([
			{
				tool: "suggest_adrs",
				args: {
					projectPath: "/workspace",
					analysisType: "comprehensive",
					conversationContext: {
						humanRequest: "canonical ADR directory",
						focusAreas: ["architecture"],
					},
				},
			},
		]);
		expect(results?.[0]?.route.engineTool).toBe("suggest_adrs");
	});
});

describe("adr-analysis passthrough input preparation", () => {
	test("injects repo-aware adrDirectory and projectPath when the tool schema supports them", async () => {
		const projectRoot = "/tmp/adr-routing";
		await mkdir(join(projectRoot, "docs", "adr"), { recursive: true });
		await writeFile(join(projectRoot, "docs", "adr", "0001-test.md"), "# ADR\n");

		const config = createDefaultConfig(projectRoot);
		const prepared = prepareAdrToolInput(
			{},
			{
				projectRoot,
				config,
				inputSchema: {
					properties: {
						adrDirectory: { type: "string" },
						projectPath: { type: "string" },
					},
				},
			},
		);

		expect(prepared.adrDirectory).toBe("docs/adr");
		expect(prepared.projectPath).toBe("/workspace");
	});

	test("normalizes legacy docs/adrs settings back to the repository ADR directory", async () => {
		const projectRoot = "/tmp/adr-routing-legacy";
		await mkdir(join(projectRoot, "docs", "adr"), { recursive: true });
		await writeFile(join(projectRoot, "docs", "adr", "0001-test.md"), "# ADR\n");

		const config = createDefaultConfig(projectRoot);
		config.engines["mcp-adr-analysis-server"].settings = {
			...config.engines["mcp-adr-analysis-server"].settings,
			adrDirectory: "docs/adrs",
		};

		const prepared = prepareAdrToolInput(
			{},
			{
				projectRoot,
				config,
				inputSchema: {
					properties: {
						adrDirectory: { type: "string" },
					},
				},
			},
		);

		expect(prepared.adrDirectory).toBe("docs/adr");
	});
});
