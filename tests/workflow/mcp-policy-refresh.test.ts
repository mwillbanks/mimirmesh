import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { createServer } from "node:net";

import { createDefaultConfig, setConfigValue } from "@mimirmesh/config";
import { persistConnection, persistRoutingTable } from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";

import { createToolRouter } from "../../packages/mcp-core/src";

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

describe("mcp policy refresh workflow", () => {
	test("applies compression policy changes to future inspection while keeping loaded groups stable", async () => {
		const repo = await createFixtureCopy("single-ts");
		const port = await reservePort();
		const config = createDefaultConfig(repo);
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
								description: "Search code across the repository using hybrid ranking.",
								inputSchema: {
									type: "object",
									properties: {
										query: { type: "string" },
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
						child: { running: true },
					});
				}
				return new Response("not found", { status: 404 });
			},
		});

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
				services: ["mm-srclight"],
				bridgePorts: {
					srclight: port,
				},
			});
			await persistRoutingTable(repo, {
				generatedAt: new Date().toISOString(),
				passthrough: [],
				unified: [],
			});

			const router = createToolRouter({
				projectRoot: repo,
				config,
				sessionId: "policy-session",
			});
			await router.loadDeferredToolGroup("srclight");
			const before = await router.inspectToolSurface();

			router.setConfig(setConfigValue(config, "mcp.toolSurface.compressionLevel", "aggressive"));
			const after = await router.inspectToolSurface();

			expect(before.loadedEngineGroups).toContain("srclight");
			expect(after.loadedEngineGroups).toContain("srclight");
			expect(after.compressionLevel).toBe("aggressive");
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});
});
