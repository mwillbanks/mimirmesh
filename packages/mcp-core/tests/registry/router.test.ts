import { afterEach, describe, expect, test } from "bun:test";
import { createServer } from "node:net";

import { createDefaultConfig } from "@mimirmesh/config";
import { persistConnection, persistRoutingTable } from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";

let bridgeServer: ReturnType<typeof Bun.serve> | null = null;

const reservePort = async (): Promise<number> =>
	new Promise((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			const port = typeof address === "object" && address ? address.port : null;
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				if (!port) {
					reject(new Error("Failed to reserve test port"));
					return;
				}
				resolve(port);
			});
		});
	});

afterEach(async () => {
	if (bridgeServer) {
		await bridgeServer.stop(true);
		bridgeServer = null;
	}
});

const loadCreateToolRouter = async () =>
	(await import(`../../src/registry/router?test=${crypto.randomUUID()}`)).createToolRouter;

const hybridSearchToolNames = ["srclight_hybrid_search", "mimirmesh.srclight.hybrid_search"];

describe("mcp tool router", () => {
	test("lists core management tools first and exposes passthrough tools only after loading a deferred group", async () => {
		const createToolRouter = await loadCreateToolRouter();
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);
		const port = await reservePort();
		bridgeServer = Bun.serve({
			port,
			fetch(request) {
				const url = new URL(request.url);
				if (url.pathname === "/discover") {
					return Response.json({
						ok: true,
						tools: [
							{
								name: "hybrid_search",
								description: "search code",
								inputSchema: {
									type: "object",
									properties: {
										query: {
											type: "string",
										},
									},
								},
							},
						],
					});
				}
				if (url.pathname === "/health") {
					return Response.json({
						ok: true,
						ready: true,
						child: {
							running: true,
						},
					});
				}
				return new Response("not found", { status: 404 });
			},
		});

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
				srclight: port,
			},
		});
		await persistRoutingTable(repo, {
			generatedAt: new Date().toISOString(),
			passthrough: [
				{
					publicTool: "mimirmesh.srclight.hybrid_search",
					engine: "srclight",
					engineTool: "hybrid_search",
					description: "search code",
					publication: {
						canonicalEngineId: "srclight",
						publishedTool: "srclight_hybrid_search",
						retiredAliases: ["mimirmesh.srclight.hybrid_search"],
					},
				},
			],
			unified: [
				{
					unifiedTool: "search_code",
					engine: "document-mcp",
					engineTool: "search_documents",
					priority: 95,
				},
				{
					unifiedTool: "search_code",
					engine: "srclight",
					engineTool: "hybrid_search",
					priority: 150,
				},
			],
		});

		const router = createToolRouter({
			projectRoot: repo,
			config,
		});

		const tools = await router.listTools();
		expect(tools.some((tool: (typeof tools)[number]) => tool.name === "explain_project")).toBe(
			true,
		);
		expect(tools.some((tool: (typeof tools)[number]) => tool.name === "find_tests")).toBe(true);
		expect(
			tools.some((tool: (typeof tools)[number]) => tool.name === "inspect_platform_code"),
		).toBe(true);
		expect(
			tools.some((tool: (typeof tools)[number]) => tool.name === "list_workspace_projects"),
		).toBe(true);
		expect(tools.some((tool: (typeof tools)[number]) => tool.name === "refresh_index")).toBe(true);
		expect(tools.some((tool: (typeof tools)[number]) => tool.name === "load_deferred_tools")).toBe(
			true,
		);
		expect(tools.some((tool: (typeof tools)[number]) => tool.name === "inspect_tool_schema")).toBe(
			true,
		);
		expect(
			tools.some((tool: (typeof tools)[number]) => hybridSearchToolNames.includes(tool.name)),
		).toBe(false);

		await router.loadDeferredToolGroup("srclight");
		const loadedTools = await router.listTools();
		expect(
			loadedTools.some((tool: (typeof loadedTools)[number]) =>
				hybridSearchToolNames.includes(tool.name),
			),
		).toBe(true);
	});

	test("returns provenance for passthrough failures", async () => {
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
			passthrough: [
				{
					publicTool: "mimirmesh.srclight.hybrid_search",
					engine: "srclight",
					engineTool: "hybrid_search",
					description: "search code",
					publication: {
						canonicalEngineId: "srclight",
						publishedTool: "srclight_hybrid_search",
						retiredAliases: ["mimirmesh.srclight.hybrid_search"],
					},
				},
			],
			unified: [],
		});

		const router = createToolRouter({
			projectRoot: repo,
			config,
		});

		const result = await router.callTool("mimirmesh.srclight.hybrid_search", { query: "export" });
		expect(result.provenance.length).toBeGreaterThan(0);
		expect(result.success).toBe(false);
		expect(result.message).toContain("Use srclight_hybrid_search instead");
		expect(result.nextAction).toContain("srclight_hybrid_search");
	});
});
