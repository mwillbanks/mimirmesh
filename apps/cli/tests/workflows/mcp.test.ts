import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { createServer } from "node:net";

import { createDefaultConfig, writeConfig } from "@mimirmesh/config";
import {
	openRouteTelemetryStore,
	persistConnection,
	persistRoutingTable,
	runRouteTelemetryMaintenance,
} from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";
import { executeWorkflowRun, type PresentationProfile } from "@mimirmesh/ui";
import { startSkillRegistryRuntime } from "../../../../tests/_helpers/skills-runtime";
import {
	createMcpListToolsWorkflow,
	createMcpLoadToolsWorkflow,
	createMcpRouteHintsWorkflow,
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

	test("reports route-hint inspection payloads through the workflow surface", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);
		const runtime = await startSkillRegistryRuntime(repo, config);
		if (!runtime.available) {
			return;
		}
		try {
			const maintenanceNow = new Date();
			const observedAt = new Date(maintenanceNow.getTime() - 5 * 60 * 1000);
			process.env.MIMIRMESH_PROJECT_ROOT = repo;
			process.env.MIMIRMESH_SESSION_ID = "workflow-session";
			await writeConfig(repo, config);
			await persistConnection(repo, {
				projectName: config.runtime.projectName,
				composeFile: config.runtime.composeFile,
				updatedAt: new Date().toISOString(),
				startedAt: new Date().toISOString(),
				mounts: {
					repository: repo,
					mimirmesh: `${repo}/.mimirmesh`,
				},
				services: ["mm-postgres"],
				bridgePorts: {},
			});
			await persistRoutingTable(repo, {
				generatedAt: new Date().toISOString(),
				passthrough: [],
				unified: [
					{
						unifiedTool: "search_code",
						engine: "srclight",
						engineTool: "hybrid_search",
						priority: 150,
						executionStrategy: "fallback-only",
						seedHint: {
							unifiedTool: "search_code",
							engine: "srclight",
							engineTool: "hybrid_search",
							executionStrategy: "fallback-only",
							adaptiveEligible: true,
							estimatedInputTokens: 80,
							estimatedOutputTokens: 24,
							estimatedLatencyMs: 160,
							expectedSuccessRate: 0.95,
							cacheAffinity: "high",
							freshnessSensitivity: "medium",
						},
					},
				],
			});
			const store = await openRouteTelemetryStore(repo, config);
			expect(store).not.toBeNull();
			if (!store) {
				throw new Error("expected route telemetry store");
			}
			try {
				await store.recordRouteExecutionEvent({
					eventId: crypto.randomUUID(),
					repoId: store.repoId,
					occurredAt: observedAt.toISOString(),
					sessionId: "workflow-session",
					requestCorrelationId: null,
					unifiedTool: "search_code",
					profileKey: "profile-search",
					sanitizedArgumentSummary: {
						shapeVersion: 1,
						queryClass: "free-text",
						hasPath: false,
						limitBand: "medium",
						promptLengthBand: "short",
						identifierLike: false,
						additionalFlags: {},
					},
					requestFingerprint: "fingerprint-search",
					engine: "srclight",
					engineTool: "hybrid_search",
					executionStrategy: "fallback-only",
					staticPriority: 150,
					attemptIndex: 1,
					outcome: "success",
					failureClassification: null,
					latencyMs: 120,
					estimatedInputTokens: 80,
					estimatedOutputTokens: 24,
					inputBytes: 100,
					outputBytes: 140,
					resultItemCount: 1,
					hintSourceModeAtExecution: "static",
					hintConfidenceAtExecution: 0,
					effectiveCostScoreAtExecution: 0,
					orderingReasonCodes: ["seed_hint", "static_priority"],
					createdAt: observedAt.toISOString(),
				});
				await runRouteTelemetryMaintenance({
					store,
					lockOwner: "workflow-route-hints:test",
					now: maintenanceNow,
				});
			} finally {
				await store.close();
			}

			const finalState = await executeWorkflowRun(
				createMcpRouteHintsWorkflow({
					unifiedTool: "search_code",
					profile: "profile-search",
					includeRollups: true,
				}),
				presentation,
			);
			const payload = finalState.outcome?.machineReadablePayload as
				| {
						telemetryHealth?: { state?: string };
						maintenanceStatus?: {
							affectedSourceLabels?: string[];
						};
						inspection?: {
							profileScope?: string;
							freshnessState?: string;
						};
				  }
				| undefined;

			expect(finalState.phase).toBe("success");
			expect(payload?.telemetryHealth).toBeDefined();
			expect(payload?.maintenanceStatus).toBeDefined();
			expect(payload?.telemetryHealth?.state).toBe("ready");
			expect(payload?.maintenanceStatus?.affectedSourceLabels).toContain("sparse");
			expect(payload?.inspection?.profileScope).toBe("profile");
			expect(payload?.inspection?.freshnessState).toBe("current");
			expect(JSON.stringify(payload)).not.toContain("sanitizedArgumentSummary");
			expect(JSON.stringify(payload)).not.toContain("requestFingerprint");
		} finally {
			await runtime.stop();
			await rm(repo, { recursive: true, force: true });
		}
	});
});
