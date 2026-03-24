import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultConfig } from "@mimirmesh/config";

import type { EngineRuntimeState } from "../../src/types";

let bridgeServer: ReturnType<typeof Bun.serve> | null = null;

type AdapterFixtureConfig = {
	engines: Record<
		string,
		{
			namespace: string;
			serviceName: string;
			required: boolean;
			image: {
				dockerfile: string;
				context: string;
				tag: string;
			};
			bridge: {
				containerPort: number;
			};
			settings: unknown;
			mounts: {
				repo: string;
				mimirmesh: string;
			};
		}
	>;
};

const installDiscoveryAdapterTestDoubles = () => {
	mock.module("@mimirmesh/mcp-adapters", () => {
		const normalizePassthroughToolSegment = (tool: string): string =>
			tool
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9_-]+/g, "_")
				.replace(/^_+|_+$/g, "") || "tool";

		const makeAdapter = (
			engine: "srclight" | "document-mcp" | "mcp-adr-analysis-server",
			bootstrapMode: "command" | "none",
		) => ({
			id: engine,
			namespace:
				engine === "srclight"
					? "mimirmesh.srclight"
					: engine === "document-mcp"
						? "mimirmesh.docs"
						: "mimirmesh.adr",
			passthroughPublication: {
				canonicalId:
					engine === "srclight" ? "srclight" : engine === "document-mcp" ? "docs" : "adr",
				eligibleForPublication: true,
			},
			bootstrap:
				bootstrapMode === "command"
					? {
							required: true,
							mode: "command" as const,
							command: "fixture",
							args: () => [],
						}
					: null,
			routingRules: [],
			resolveUnifiedRoutes: () => [],
			translateConfig: (_projectRoot: string, config: AdapterFixtureConfig) => {
				const engineConfig = config.engines[engine];
				if (!engineConfig) {
					throw new Error(`Missing engine config for ${engine}`);
				}

				return {
					contract: {
						id: engine,
						namespace: engineConfig.namespace,
						serviceName: engineConfig.serviceName,
						required: engineConfig.required,
						dockerfile: engineConfig.image.dockerfile,
						context: engineConfig.image.context,
						imageTag: engineConfig.image.tag,
						bridgePort: engineConfig.bridge.containerPort,
						bridgeTransport: engine === "srclight" ? "sse" : "stdio",
						env: {
							SETTINGS: JSON.stringify(engineConfig.settings),
							SERVICE: engineConfig.serviceName,
						},
						mounts: engineConfig.mounts,
					},
					errors: [],
					degraded: false,
				};
			},
		});

		const adapters = [
			makeAdapter("srclight", "command"),
			makeAdapter("document-mcp", "none"),
			makeAdapter("mcp-adr-analysis-server", "none"),
		];

		return {
			allEngineAdapters: adapters,
			buildLegacyPassthroughToolName: (namespace: string, tool: string) =>
				`${namespace}.${normalizePassthroughToolSegment(tool)}`,
			buildPublishedPassthroughToolName: (canonicalId: string, tool: string) =>
				`${canonicalId}_${normalizePassthroughToolSegment(tool)}`,
			getAdapter: (engine: string) => {
				const adapter = adapters.find((entry) => entry.id === engine);
				if (!adapter) {
					throw new Error(`Unknown engine adapter: ${engine}`);
				}
				return adapter;
			},
		};
	});
};

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
					reject(new Error("Failed to reserve an ephemeral port"));
					return;
				}
				resolve(port);
			});
		});
	});

afterEach(async () => {
	mock.restore();
	if (bridgeServer) {
		await bridgeServer.stop(true);
		bridgeServer = null;
	}
});

const loadDiscoverEngineCapability = async () => {
	mock.restore();
	installDiscoveryAdapterTestDoubles();
	const module = await import(`../../src/discovery/discover?restore=${Date.now()}`);
	return module.discoverEngineCapability;
};

describe("discoverEngineCapability", () => {
	test("publishes passthrough routes when discovery succeeds after a stale health failure", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-discovery-"));

		try {
			const discoverEngineCapability = await loadDiscoverEngineCapability();
			const config = createDefaultConfig(projectRoot);
			config.engines.srclight.enabled = false;
			config.engines["mcp-adr-analysis-server"].enabled = false;
			const port = await reservePort();

			bridgeServer = Bun.serve({
				port,
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

			const documentState = result.states.find(
				(state: EngineRuntimeState) => state.engine === "document-mcp",
			);
			expect(documentState?.health.state).toBe("healthy");
			expect(documentState?.bridge.transport).toBe("stdio");
			expect(result.routingTable.passthrough).toEqual([
				expect.objectContaining({
					publicTool: "mimirmesh.docs.search_documents",
					engine: "document-mcp",
					engineTool: "search_documents",
					publication: {
						canonicalEngineId: "docs",
						publishedTool: "docs_search_documents",
						retiredAliases: ["mimirmesh.docs.search_documents"],
					},
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
			const discoverEngineCapability = await loadDiscoverEngineCapability();
			const config = createDefaultConfig(projectRoot);
			config.engines["document-mcp"].enabled = false;
			config.engines["mcp-adr-analysis-server"].enabled = false;
			const port = await reservePort();

			bridgeServer = Bun.serve({
				port,
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

			const srclightState = result.states.find(
				(state: EngineRuntimeState) => state.engine === "srclight",
			);
			expect(srclightState?.bridge.transport).toBe("sse");
			expect(srclightState?.runtimeEvidence?.bootstrapMode).toBe("command");
			expect(result.routingTable.passthrough).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						publicTool: "mimirmesh.srclight.search_symbols",
						publication: {
							canonicalEngineId: "srclight",
							publishedTool: "srclight_search_symbols",
							retiredAliases: ["mimirmesh.srclight.search_symbols"],
						},
					}),
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
