import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createDefaultConfig } from "@mimirmesh/config";
import { persistConnection, persistRoutingTable } from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";

const invokeEngineToolMock = mock(
	async (): Promise<{ ok: boolean; result?: unknown; error?: string }> => ({
		ok: true,
		result: {},
	}),
);

const translateConfigStub = (engine: string) => ({
	contract: {
		id: engine,
		namespace:
			engine === "srclight"
				? "mimirmesh.srclight"
				: engine === "document-mcp"
					? "mimirmesh.docs"
					: "mimirmesh.adr",
		serviceName: `mm-${engine}`,
		required: false,
		dockerfile: "Dockerfile",
		context: ".",
		imageTag: `mimirmesh/${engine}:test`,
		bridgePort: 0,
		bridgeTransport: engine === "srclight" ? ("sse" as const) : ("stdio" as const),
		env: {},
		mounts: {
			repo: "/workspace",
			mimirmesh: "/mimirmesh",
		},
	},
	errors: [],
	degraded: false,
});

const getAdapterMock = mock((engine: string) => {
	if (engine === "srclight") {
		return {
			translateConfig: () => translateConfigStub(engine),
			prepareToolInput: (toolName: string, input: Record<string, unknown>) => {
				if (toolName === "search_symbols" && typeof input.symbol === "string") {
					return { query: input.symbol };
				}

				return input;
			},
		};
	}

	if (engine === "mcp-adr-analysis-server") {
		return {
			translateConfig: () => translateConfigStub(engine),
			prepareToolInput: (
				_toolName: string,
				input: Record<string, unknown>,
				context: { inputSchema?: Record<string, unknown> },
			) => {
				const properties = context.inputSchema?.properties;
				if (
					typeof properties === "object" &&
					properties !== null &&
					"adrDirectory" in properties &&
					input.adrDirectory == null
				) {
					return {
						...input,
						adrDirectory: "docs/adr",
					};
				}

				return input;
			},
		};
	}

	return {
		translateConfig: () => translateConfigStub(engine),
	};
});

const loadCreateToolRouter = async () => {
	mock.restore();
	mock.module("@mimirmesh/mcp-adapters", () => ({
		getAdapter: getAdapterMock,
	}));
	mock.module("../../src/transport/bridge", () => ({
		invokeEngineTool: invokeEngineToolMock,
	}));

	const module = await import("../../src/registry/router");
	return module.createToolRouter;
};

describe("mcp tool router regressions", () => {
	beforeEach(() => {
		invokeEngineToolMock.mockReset();
		getAdapterMock.mockClear();
	});

	afterEach(() => {
		mock.restore();
	});

	test("prepares fallback unified inputs through the adapter before invoking engine tools", async () => {
		const createToolRouter = await loadCreateToolRouter();
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);

		await persistConnection(repo, {
			projectName: config.runtime.projectName,
			composeFile: config.runtime.composeFile,
			updatedAt: new Date().toISOString(),
			startedAt: new Date().toISOString(),
			mounts: {
				repository: repo,
				mimirmesh: `${repo}/.mimirmesh`,
			},
			services: ["mm-srclight"],
			bridgePorts: {
				srclight: 65530,
			},
		});
		await persistRoutingTable(repo, {
			generatedAt: new Date().toISOString(),
			passthrough: [],
			unified: [
				{
					unifiedTool: "explain_subsystem",
					engine: "srclight",
					engineTool: "search_symbols",
					priority: 145,
					inputSchema: {
						properties: {
							query: { type: "string" },
						},
					},
				},
			],
		});

		invokeEngineToolMock.mockResolvedValueOnce({
			ok: true,
			result: {
				results: [{ symbol: "ToolRouter" }],
			},
		});

		const router = createToolRouter({
			projectRoot: repo,
			config,
		});

		const result = await router.callTool("explain_subsystem", { symbol: "ToolRouter" });

		expect(result.success).toBe(true);
		expect(invokeEngineToolMock).toHaveBeenCalledWith({
			bridgePorts: { srclight: 65530 },
			engine: "srclight",
			tool: "search_symbols",
			args: { query: "ToolRouter" },
		});
	});

	test("falls back to discovered ADR validation when upstream reports zero ADRs", async () => {
		const createToolRouter = await loadCreateToolRouter();
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);

		await persistConnection(repo, {
			projectName: config.runtime.projectName,
			composeFile: config.runtime.composeFile,
			updatedAt: new Date().toISOString(),
			startedAt: new Date().toISOString(),
			mounts: {
				repository: repo,
				mimirmesh: `${repo}/.mimirmesh`,
			},
			services: ["mm-adr-analysis"],
			bridgePorts: {
				"mcp-adr-analysis-server": 65531,
			},
		});
		await persistRoutingTable(repo, {
			generatedAt: new Date().toISOString(),
			passthrough: [
				{
					publicTool: "mimirmesh.mcp-adr-analysis-server.validate_all_adrs",
					engine: "mcp-adr-analysis-server",
					engineTool: "validate_all_adrs",
					inputSchema: {
						properties: {
							adrDirectory: { type: "string" },
						},
					},
				},
				{
					publicTool: "mimirmesh.mcp-adr-analysis-server.discover_existing_adrs",
					engine: "mcp-adr-analysis-server",
					engineTool: "discover_existing_adrs",
					inputSchema: {
						properties: {
							adrDirectory: { type: "string" },
						},
					},
				},
				{
					publicTool: "mimirmesh.mcp-adr-analysis-server.validate_adr",
					engine: "mcp-adr-analysis-server",
					engineTool: "validate_adr",
					inputSchema: {
						properties: {
							adrDirectory: { type: "string" },
							adrPath: { type: "string" },
						},
					},
				},
			],
			unified: [],
		});

		invokeEngineToolMock
			.mockResolvedValueOnce({
				ok: true,
				result: {
					content: [{ text: "**Total ADRs Validated**: 0" }],
				},
			})
			.mockResolvedValueOnce({
				ok: true,
				result: {
					content: [
						{
							text: "- **Path**: docs/adr/0001-test.md\n- **Path**: docs/adr/0002-test.md",
						},
					],
				},
			})
			.mockResolvedValueOnce({
				ok: true,
				result: { path: "docs/adr/0001-test.md", status: "valid" },
			})
			.mockResolvedValueOnce({
				ok: true,
				result: { path: "docs/adr/0002-test.md", status: "valid" },
			});

		const router = createToolRouter({
			projectRoot: repo,
			config,
		});

		const result = await router.callTool("mimirmesh.mcp-adr-analysis-server.validate_all_adrs", {});

		expect(result.success).toBe(true);
		expect(result.message).toContain("Validated 2 ADR(s)");
		expect(result.items).toHaveLength(2);
		expect(invokeEngineToolMock).toHaveBeenNthCalledWith(1, {
			bridgePorts: { "mcp-adr-analysis-server": 65531 },
			engine: "mcp-adr-analysis-server",
			tool: "validate_all_adrs",
			args: { adrDirectory: "docs/adr" },
		});
		expect(invokeEngineToolMock).toHaveBeenNthCalledWith(2, {
			bridgePorts: { "mcp-adr-analysis-server": 65531 },
			engine: "mcp-adr-analysis-server",
			tool: "discover_existing_adrs",
			args: { adrDirectory: "docs/adr" },
		});
		expect(invokeEngineToolMock).toHaveBeenNthCalledWith(3, {
			bridgePorts: { "mcp-adr-analysis-server": 65531 },
			engine: "mcp-adr-analysis-server",
			tool: "validate_adr",
			args: { adrPath: "/workspace/docs/adr/0001-test.md", adrDirectory: "docs/adr" },
		});
		expect(invokeEngineToolMock).toHaveBeenNthCalledWith(4, {
			bridgePorts: { "mcp-adr-analysis-server": 65531 },
			engine: "mcp-adr-analysis-server",
			tool: "validate_adr",
			args: { adrPath: "/workspace/docs/adr/0002-test.md", adrDirectory: "docs/adr" },
		});
		expect(result.warningCodes).toContain("upstream_tool_fallback_used");
	});

	test("translates host and repository paths for ADR passthrough tools", async () => {
		const createToolRouter = await loadCreateToolRouter();
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);
		await mkdir(join(repo, "docs", "adr"), { recursive: true });
		await writeFile(join(repo, "docs", "adr", "0001-test.md"), "# ADR\n", "utf8");

		await persistConnection(repo, {
			projectName: config.runtime.projectName,
			composeFile: config.runtime.composeFile,
			updatedAt: new Date().toISOString(),
			startedAt: new Date().toISOString(),
			mounts: {
				repository: repo,
				mimirmesh: `${repo}/.mimirmesh`,
			},
			services: ["mm-adr-analysis"],
			bridgePorts: {
				"mcp-adr-analysis-server": 65531,
			},
		});
		await persistRoutingTable(repo, {
			generatedAt: new Date().toISOString(),
			passthrough: [
				{
					publicTool: "mimirmesh.adr.validate_all_adrs",
					engine: "mcp-adr-analysis-server",
					engineTool: "validate_all_adrs",
					inputSchema: {
						properties: {
							projectPath: { type: "string" },
							adrDirectory: { type: "string" },
						},
					},
				},
				{
					publicTool: "mimirmesh.adr.validate_rules",
					engine: "mcp-adr-analysis-server",
					engineTool: "validate_rules",
					inputSchema: {
						properties: {
							filePath: { type: "string" },
							validationType: { type: "string" },
						},
					},
				},
			],
			unified: [],
		});

		invokeEngineToolMock
			.mockResolvedValueOnce({
				ok: true,
				result: { projectPath: "/workspace", adrDirectory: "docs/adr" },
			})
			.mockResolvedValueOnce({
				ok: true,
				result: { filePath: "/workspace/docs/adr/0001-test.md", status: "ok" },
			});

		const router = createToolRouter({
			projectRoot: repo,
			config,
		});

		const validateAll = await router.callTool("mimirmesh.adr.validate_all_adrs", {
			projectPath: repo,
			adrDirectory: "docs/adr",
		});
		const validateRules = await router.callTool("mimirmesh.adr.validate_rules", {
			filePath: "docs/adr/0001-test.md",
			validationType: "file",
		});

		expect(invokeEngineToolMock).toHaveBeenNthCalledWith(1, {
			bridgePorts: { "mcp-adr-analysis-server": 65531 },
			engine: "mcp-adr-analysis-server",
			tool: "validate_all_adrs",
			args: { projectPath: "/workspace", adrDirectory: "docs/adr" },
		});
		expect(invokeEngineToolMock).toHaveBeenNthCalledWith(2, {
			bridgePorts: { "mcp-adr-analysis-server": 65531 },
			engine: "mcp-adr-analysis-server",
			tool: "validate_rules",
			args: { filePath: "/workspace/docs/adr/0001-test.md", validationType: "file" },
		});
		expect(validateAll.items[0]?.content).toContain(repo);
		expect(validateRules.items[0]?.content).toContain(repo);
	});

	test("keeps passthrough routes without publication metadata outside the naming contract", async () => {
		const createToolRouter = await loadCreateToolRouter();
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);

		await persistConnection(repo, {
			projectName: config.runtime.projectName,
			composeFile: config.runtime.composeFile,
			updatedAt: new Date().toISOString(),
			startedAt: new Date().toISOString(),
			mounts: {
				repository: repo,
				mimirmesh: `${repo}/.mimirmesh`,
			},
			services: ["mm-docs"],
			bridgePorts: {
				"document-mcp": 65532,
			},
		});
		await persistRoutingTable(repo, {
			generatedAt: new Date().toISOString(),
			passthrough: [
				{
					publicTool: "external.docs.lookup",
					engine: "document-mcp",
					engineTool: "search_documents",
					description: "External passthrough tool",
				},
			],
			unified: [],
		});

		invokeEngineToolMock.mockResolvedValueOnce({
			ok: true,
			result: {
				match: "README.md",
			},
		});

		const router = createToolRouter({
			projectRoot: repo,
			config,
		});

		const tools = await router.listTools();
		const result = await router.callTool("external.docs.lookup", {});

		expect(tools.some((tool) => tool.name === "external.docs.lookup")).toBe(true);
		expect(result.success).toBe(true);
		expect(invokeEngineToolMock).toHaveBeenCalledWith({
			bridgePorts: { "document-mcp": 65532 },
			engine: "document-mcp",
			tool: "search_documents",
			args: {},
		});
	});

	test("fails fast with a validation error when passthrough input misses required fields", async () => {
		const createToolRouter = await loadCreateToolRouter();
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);

		await persistConnection(repo, {
			projectName: config.runtime.projectName,
			composeFile: config.runtime.composeFile,
			updatedAt: new Date().toISOString(),
			startedAt: new Date().toISOString(),
			mounts: {
				repository: repo,
				mimirmesh: `${repo}/.mimirmesh`,
			},
			services: ["mm-adr-analysis"],
			bridgePorts: {
				"mcp-adr-analysis-server": 65531,
			},
		});
		await persistRoutingTable(repo, {
			generatedAt: new Date().toISOString(),
			passthrough: [
				{
					publicTool: "mimirmesh.adr.validate_rules",
					engine: "mcp-adr-analysis-server",
					engineTool: "validate_rules",
					inputSchema: {
						required: ["filePath", "rules"],
						properties: {
							filePath: { type: "string" },
							rules: { type: "array" },
						},
					},
				},
			],
			unified: [],
		});

		const router = createToolRouter({
			projectRoot: repo,
			config,
		});

		const result = await router.callTool("mimirmesh.adr.validate_rules", {
			filePath: "docs/adr/0001-test.md",
		});

		expect(result.success).toBe(false);
		expect(result.message).toContain("missing required field(s): rules");
		expect(invokeEngineToolMock).not.toHaveBeenCalled();
	});
});
