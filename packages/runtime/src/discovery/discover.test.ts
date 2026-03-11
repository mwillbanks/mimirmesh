import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultConfig } from "@mimirmesh/config";

import { discoverEngineCapability } from "./discover";

let bridgeServer: ReturnType<typeof Bun.serve> | null = null;

afterEach(async () => {
	if (bridgeServer) {
		await bridgeServer.stop(true);
		bridgeServer = null;
	}
});

describe("discoverEngineCapability", () => {
	test("publishes passthrough routes when discovery succeeds after a stale health failure", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-discovery-"));

		try {
			const config = createDefaultConfig(projectRoot);
			config.engines.srclight.enabled = false;
			config.engines["mcp-adr-analysis-server"].enabled = false;
			config.engines["codebase-memory-mcp"].enabled = false;

			bridgeServer = Bun.serve({
				port: 0,
				fetch(request) {
					const url = new URL(request.url);

					if (url.pathname === "/health") {
						return Response.json({
							ok: true,
							ready: false,
							child: {
								running: false,
								lastError: "MCP error -32001: Request timed out",
							},
						});
					}

					if (url.pathname === "/discover") {
						return Response.json({
							ok: true,
							tools: [
								{
									name: "search_documents",
									description: "Search indexed documents",
									inputSchema: {
										type: "object",
										properties: {
											input: {
												type: "object",
											},
										},
									},
								},
							],
						});
					}

					return new Response("not found", { status: 404 });
				},
			});

			const result = await discoverEngineCapability({
				projectRoot,
				config,
				bridgePorts: {
					"document-mcp": bridgeServer.port,
				},
				startedAt: "2026-03-12T00:00:00.000Z",
				attempts: 1,
			});

			const documentState = result.states.find((state) => state.engine === "document-mcp");
			expect(documentState?.health.state).toBe("healthy");
			expect(documentState?.bridge.transport).toBe("stdio");
			expect(result.routingTable.passthrough).toEqual([
				expect.objectContaining({
					publicTool: "mimirmesh.docs.search_documents",
					engine: "document-mcp",
					engineTool: "search_documents",
				}),
			]);
		} finally {
			if (bridgeServer) {
				await bridgeServer.stop(true);
				bridgeServer = null;
			}
			await rm(projectRoot, { recursive: true, force: true });
		}
	});

	test("records SSE bridge transport for Srclight discovery", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-srclight-discovery-"));

		try {
			const config = createDefaultConfig(projectRoot);
			config.engines["document-mcp"].enabled = false;
			config.engines["mcp-adr-analysis-server"].enabled = false;
			config.engines["codebase-memory-mcp"].enabled = false;

			bridgeServer = Bun.serve({
				port: 0,
				fetch(request) {
					const url = new URL(request.url);

					if (url.pathname === "/health") {
						return Response.json({
							ok: true,
							ready: true,
							child: {
								running: true,
							},
						});
					}

					if (url.pathname === "/discover") {
						return Response.json({
							ok: true,
							tools: [{ name: "search_symbols" }, { name: "hybrid_search" }],
						});
					}

					return new Response("not found", { status: 404 });
				},
			});

			const result = await discoverEngineCapability({
				projectRoot,
				config,
				bridgePorts: {
					srclight: bridgeServer.port,
				},
				startedAt: "2026-03-12T00:00:00.000Z",
				attempts: 1,
			});

			const srclightState = result.states.find((state) => state.engine === "srclight");
			expect(srclightState?.bridge.transport).toBe("sse");
			expect(srclightState?.runtimeEvidence?.bootstrapMode).toBe("command");
			expect(result.routingTable.passthrough).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ publicTool: "mimirmesh.srclight.search_symbols" }),
				]),
			);
		} finally {
			if (bridgeServer) {
				await bridgeServer.stop(true);
				bridgeServer = null;
			}
			await rm(projectRoot, { recursive: true, force: true });
		}
	});
});
