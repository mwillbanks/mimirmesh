import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";

import { persistConnection, persistRoutingTable } from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repoRoot = resolve(import.meta.dir, "..", "..", "..", "..");
const serverEntry = join(repoRoot, "apps", "server", "src", "index.ts");

const createConnectedClient = async (projectRoot: string) => {
	const transport = new StdioClientTransport({
		command: "bun",
		args: ["run", serverEntry],
		env: {
			...process.env,
			MIMIRMESH_PROJECT_ROOT: projectRoot,
		},
		stderr: "pipe",
		cwd: repoRoot,
	});
	const client = new Client(
		{
			name: "startup-test-client",
			version: "1.0.0",
		},
		{
			capabilities: {},
		},
	);
	await client.connect(transport);
	return {
		client,
		transport,
	};
};

const activeClients: Array<Awaited<ReturnType<typeof createConnectedClient>>> = [];
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
	while (activeClients.length > 0) {
		const active = activeClients.pop();
		if (!active) {
			continue;
		}
		await active.client.close();
		await active.transport.close();
	}
	if (bridgeServer) {
		await bridgeServer.stop(true);
		bridgeServer = null;
	}
});

describe("server startup MCP publication", () => {
	test("publishes only core management tools at startup and exposes passthrough routes after deferred load", async () => {
		const repo = await createFixtureCopy("single-ts");
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
								name: "search_symbols",
								description: "Search symbols",
								inputSchema: {
									type: "object",
									properties: {
										query: {
											type: "string",
										},
									},
								},
							},
							{
								name: "find_symbol",
								description:
									"Locate symbols with detailed repository-scoped guidance, exact-match controls, and fallback behavior documentation.",
								inputSchema: {
									type: "object",
									properties: {
										query: { type: "string", description: "Symbol name or exact identifier" },
										path: { type: "string", description: "Optional path scope" },
										limit: { type: "number", description: "Maximum result count" },
									},
								},
							},
							{
								name: "get_callees",
								description:
									"Trace symbol callees with impact-analysis metadata, caller/callee interpretation hints, and result ranking context.",
								inputSchema: {
									type: "object",
									properties: {
										query: { type: "string", description: "Symbol name or exact identifier" },
										path: { type: "string", description: "Optional path scope" },
										limit: { type: "number", description: "Maximum result count" },
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

		try {
			await persistConnection(repo, {
				projectName: "startup-test",
				composeFile: join(repo, ".mimirmesh", "runtime", "docker-compose.yml"),
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
						publicTool: "mimirmesh.srclight.search_symbols",
						engine: "srclight",
						engineTool: "search_symbols",
						description: "Search symbols",
						publication: {
							canonicalEngineId: "srclight",
							publishedTool: "srclight_search_symbols",
							retiredAliases: ["mimirmesh.srclight.search_symbols"],
						},
					},
				],
				unified: [],
			});

			const active = await createConnectedClient(repo);
			activeClients.push(active);

			const listed = await active.client.listTools();
			expect(listed.tools.some((tool) => tool.name === "load_deferred_tools")).toBe(true);
			expect(listed.tools.some((tool) => tool.name === "inspect_tool_schema")).toBe(true);
			expect(listed.tools.some((tool) => tool.name === "srclight_search_symbols")).toBe(false);
			expect(listed.tools.some((tool) => tool.name === "mimirmesh_srclight_search_symbols")).toBe(
				false,
			);

			await active.client.callTool({
				name: "load_deferred_tools",
				arguments: {
					engine: "srclight",
				},
			});

			const afterLoad = await active.client.listTools();
			expect(afterLoad.tools.some((tool) => tool.name === "srclight_search_symbols")).toBe(true);

			const retired = await active.client.callTool({
				name: "mimirmesh_srclight_search_symbols",
				arguments: {
					query: "ToolRouter",
				},
			});
			expect(retired.isError).toBe(true);
			expect(JSON.stringify(retired.structuredContent ?? retired.content)).toContain(
				"srclight_search_symbols",
			);
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	}, 30_000);

	test("keeps initial startup publication smaller than the loaded passthrough payload", async () => {
		const repo = await createFixtureCopy("single-ts");
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
								name: "search_symbols",
								description:
									"Search symbols with detailed repository-scoped guidance and explicit result-shaping metadata for callers.",
								inputSchema: {
									type: "object",
									properties: {
										query: { type: "string", description: "Precise symbol query" },
										path: { type: "string", description: "Optional path scope" },
										limit: { type: "number", description: "Maximum result count" },
									},
								},
							},
							{
								name: "hybrid_search",
								description:
									"Search code using hybrid ranking with path, scope, and result window controls.",
								inputSchema: {
									type: "object",
									properties: {
										query: { type: "string", description: "Repository search text" },
										path: { type: "string", description: "Optional path scope" },
										limit: { type: "number", description: "Maximum result count" },
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

		try {
			await persistConnection(repo, {
				projectName: "startup-benchmark-test",
				composeFile: join(repo, ".mimirmesh", "runtime", "docker-compose.yml"),
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
						publicTool: "mimirmesh.srclight.search_symbols",
						engine: "srclight",
						engineTool: "search_symbols",
						description:
							"Search symbols with detailed repository-scoped guidance and explicit result-shaping metadata for callers.",
						inputSchema: {
							type: "object",
							properties: {
								query: { type: "string", description: "Precise symbol query" },
								path: { type: "string", description: "Optional path scope" },
								limit: { type: "number", description: "Maximum result count" },
							},
						},
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
						description:
							"Search code using hybrid ranking with path, scope, and result window controls.",
						inputSchema: {
							type: "object",
							properties: {
								query: { type: "string", description: "Repository search text" },
								path: { type: "string", description: "Optional path scope" },
								limit: { type: "number", description: "Maximum result count" },
							},
						},
						publication: {
							canonicalEngineId: "srclight",
							publishedTool: "srclight_hybrid_search",
							retiredAliases: ["mimirmesh.srclight.hybrid_search"],
						},
					},
					{
						publicTool: "mimirmesh.srclight.find_symbol",
						engine: "srclight",
						engineTool: "find_symbol",
						description:
							"Locate symbols with detailed repository-scoped guidance, exact-match controls, and fallback behavior documentation.",
						inputSchema: {
							type: "object",
							properties: {
								query: { type: "string", description: "Symbol name or exact identifier" },
								path: { type: "string", description: "Optional path scope" },
								limit: { type: "number", description: "Maximum result count" },
							},
						},
						publication: {
							canonicalEngineId: "srclight",
							publishedTool: "srclight_find_symbol",
							retiredAliases: ["mimirmesh.srclight.find_symbol"],
						},
					},
					{
						publicTool: "mimirmesh.srclight.get_callees",
						engine: "srclight",
						engineTool: "get_callees",
						description:
							"Trace symbol callees with impact-analysis metadata, caller/callee interpretation hints, and result ranking context.",
						inputSchema: {
							type: "object",
							properties: {
								query: { type: "string", description: "Symbol name or exact identifier" },
								path: { type: "string", description: "Optional path scope" },
								limit: { type: "number", description: "Maximum result count" },
							},
						},
						publication: {
							canonicalEngineId: "srclight",
							publishedTool: "srclight_get_callees",
							retiredAliases: ["mimirmesh.srclight.get_callees"],
						},
					},
				],
				unified: [],
			});
			const active = await createConnectedClient(repo);
			activeClients.push(active);

			const listed = await active.client.listTools();
			const initialBytes = JSON.stringify(listed.tools).length;

			await active.client.callTool({
				name: "load_deferred_tools",
				arguments: {
					engine: "srclight",
				},
			});

			const afterLoad = await active.client.listTools();
			const loadedBytes = JSON.stringify(afterLoad.tools).length;
			const reduction = 1 - initialBytes / loadedBytes;

			expect(loadedBytes).toBeGreaterThan(initialBytes);
			expect(reduction).toBeGreaterThanOrEqual(0.05);
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	}, 30_000);
});
