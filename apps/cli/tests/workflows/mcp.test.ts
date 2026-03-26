import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { createServer } from "node:net";

import { createDefaultConfig } from "@mimirmesh/config";
import { persistConnection, persistRoutingTable } from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";
import { executeWorkflowRun, type PresentationProfile } from "@mimirmesh/ui";

import {
	createMcpListToolsWorkflow,
	createMcpLoadToolsWorkflow,
	createMcpToolSchemaWorkflow,
} from "../../src/workflows/mcp";

const presentation: PresentationProfile = {
	mode: "direct-human",
	interactive: false,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "wide",
};

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
	delete process.env.MIMIRMESH_PROJECT_ROOT;
	delete process.env.MIMIRMESH_SESSION_ID;
});

describe("mcp workflows", () => {
	test("lists session-scoped tool-surface metadata for deferred groups", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);
		try {
			process.env.MIMIRMESH_PROJECT_ROOT = repo;
			process.env.MIMIRMESH_SESSION_ID = "workflow-session";
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
						description: "Search code",
						publication: {
							canonicalEngineId: "srclight",
							publishedTool: "srclight_hybrid_search",
							retiredAliases: ["mimirmesh.srclight.hybrid_search"],
						},
					},
				],
				unified: [],
			});

			const finalState = await executeWorkflowRun(createMcpListToolsWorkflow(), presentation);
			const payload = finalState.outcome?.machineReadablePayload as
				| {
						sessionId: string;
						deferredEngineGroups: Array<{ engineId: string }>;
				  }
				| undefined;

			expect(finalState.phase).toBe("degraded");
			expect(payload?.sessionId).toBe("workflow-session");
			expect(payload?.deferredEngineGroups.some((group) => group.engineId === "srclight")).toBe(
				true,
			);
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});

	test("loads a deferred engine group into the current workflow session", async () => {
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
								description: "Search code",
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

		try {
			process.env.MIMIRMESH_PROJECT_ROOT = repo;
			process.env.MIMIRMESH_SESSION_ID = "workflow-session";
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

			const finalState = await executeWorkflowRun(
				createMcpLoadToolsWorkflow("srclight"),
				presentation,
			);
			const payload = finalState.outcome?.machineReadablePayload as
				| { loadedEngineGroups: string[] }
				| undefined;

			expect(finalState.phase).toBe("success");
			expect(payload?.loadedEngineGroups).toContain("srclight");
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});

	test("returns full schema detail for visible unified tools", async () => {
		const repo = await createFixtureCopy("single-ts");
		try {
			process.env.MIMIRMESH_PROJECT_ROOT = repo;
			process.env.MIMIRMESH_SESSION_ID = "workflow-session";

			const finalState = await executeWorkflowRun(
				createMcpToolSchemaWorkflow("explain_project", "full"),
				presentation,
			);
			const payload = finalState.outcome?.machineReadablePayload as
				| { schemaPayload: { inputSchema?: Record<string, unknown> } }
				| undefined;

			expect(finalState.phase).toBe("success");
			expect(payload?.schemaPayload.inputSchema).toBeDefined();
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});
});
