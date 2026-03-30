import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { createDefaultConfig, writeConfig } from "@mimirmesh/config";
import {
	openRouteTelemetryStore,
	persistConnection,
	persistRoutingTable,
	runRouteTelemetryMaintenance,
} from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { startSkillRegistryRuntime } from "../../../../tests/_helpers/skills-runtime";
import { startRouteTelemetryMaintenanceLoop } from "../../src/startup/start-server";

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
			name: "inspect-route-hints-test-client",
			version: "1.0.0",
		},
		{
			capabilities: {},
		},
	);
	await client.connect(transport);
	return { client, transport };
};

const activeClients: Array<Awaited<ReturnType<typeof createConnectedClient>>> = [];

afterEach(async () => {
	while (activeClients.length > 0) {
		const active = activeClients.pop();
		if (!active) {
			continue;
		}
		await active.client.close();
		await active.transport.close();
	}
});

describe("inspect_route_hints MCP surface", () => {
	test("publishes inspect_route_hints at startup and returns canonical inspection state without raw payload fields", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);
		const runtime = await startSkillRegistryRuntime(repo, config);
		if (!runtime.available) {
			return;
		}

		try {
			const maintenanceNow = new Date();
			const observedAt = new Date(maintenanceNow.getTime() - 5 * 60 * 1000);
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
					sessionId: "inspect-route-hints",
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
					lockOwner: "inspect-route-hints:test",
					now: maintenanceNow,
				});
			} finally {
				await store.close();
			}

			const active = await createConnectedClient(repo);
			activeClients.push(active);

			const listed = await active.client.listTools();
			expect(listed.tools.some((tool) => tool.name === "inspect_route_hints")).toBe(true);

			const response = (await active.client.callTool({
				name: "inspect_route_hints",
				arguments: {
					unifiedTool: "search_code",
					profile: "profile-search",
					includeRollups: true,
				},
			})) as {
				isError?: boolean;
				structuredContent?: {
					result?: {
						raw?: Record<string, unknown>;
					};
				};
			};

			expect(response.isError).toBe(false);
			const payload = response.structuredContent?.result?.raw as {
				telemetryHealth: { state: string; warnings: string[] };
				maintenanceStatus: {
					compactionProgress: { closedBucketCount: number; remainingBucketCount: number };
					affectedSourceLabels: string[];
				};
				inspection: {
					profileScope: string;
					sourceMode: string;
					sourceLabel: string;
					freshnessState: string;
					freshnessAgeSeconds: number | null;
					recentRollups?: { last15m: unknown[] };
				};
			};

			expect(payload.telemetryHealth.state).toBe("ready");
			expect(payload.maintenanceStatus.compactionProgress.closedBucketCount).toBe(0);
			expect(payload.maintenanceStatus.affectedSourceLabels).toContain("sparse");
			expect(payload.inspection.profileScope).toBe("profile");
			expect(payload.inspection.sourceMode).toBe("insufficient-data");
			expect(payload.inspection.sourceLabel).toBe("sparse");
			expect(payload.inspection.freshnessState).toBe("current");
			expect(payload.inspection.freshnessAgeSeconds).toBeGreaterThanOrEqual(0);
			expect(payload.inspection.recentRollups?.last15m.length).toBeGreaterThan(0);

			const serialized = JSON.stringify(payload);
			expect(serialized).not.toContain("sanitizedArgumentSummary");
			expect(serialized).not.toContain("requestFingerprint");
		} finally {
			await runtime.stop();
			await rm(repo, { recursive: true, force: true });
		}
	}, 120_000);

	test("returns synthesized seed-only summary ordering after tool telemetry is cleared", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);
		const runtime = await startSkillRegistryRuntime(repo, config);
		if (!runtime.available) {
			return;
		}

		try {
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
					{
						unifiedTool: "search_code",
						engine: "srclight",
						engineTool: "semantic_search",
						priority: 145,
						executionStrategy: "fallback-only",
						seedHint: {
							unifiedTool: "search_code",
							engine: "srclight",
							engineTool: "semantic_search",
							executionStrategy: "fallback-only",
							adaptiveEligible: true,
							estimatedInputTokens: 60,
							estimatedOutputTokens: 20,
							estimatedLatencyMs: 140,
							expectedSuccessRate: 0.92,
							cacheAffinity: "medium",
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
				await store.clearScope({
					scope: "tool",
					unifiedTool: "search_code",
				});
			} finally {
				await store.close();
			}

			const active = await createConnectedClient(repo);
			activeClients.push(active);
			const response = (await active.client.callTool({
				name: "inspect_route_hints",
				arguments: {
					unifiedTool: "search_code",
				},
			})) as {
				isError?: boolean;
				structuredContent?: {
					result?: {
						raw?: Record<string, unknown>;
					};
				};
			};

			expect(response.isError).toBe(false);
			const payload = response.structuredContent?.result?.raw as {
				inspection: {
					profileScope: string;
					profiles: Array<{
						profileKey: string;
						sourceMode: string;
						sourceLabel: string;
						sampleCount: number;
						currentOrdering: Array<{ engine: string; engineTool: string }>;
					}>;
				};
			};

			expect(payload.inspection.profileScope).toBe("summary");
			expect(payload.inspection.profiles).toHaveLength(1);
			expect(payload.inspection.profiles[0]).toMatchObject({
				profileKey: "seed-only",
				sourceMode: "static",
				sourceLabel: "seed-only",
				sampleCount: 0,
			});
			expect(payload.inspection.profiles[0]?.currentOrdering).toEqual([
				expect.objectContaining({
					engine: "srclight",
					engineTool: "hybrid_search",
				}),
				expect.objectContaining({
					engine: "srclight",
					engineTool: "semantic_search",
				}),
			]);
		} finally {
			await runtime.stop();
			await rm(repo, { recursive: true, force: true });
		}
	}, 120_000);

	test("starts periodic route telemetry maintenance when runtime PostgreSQL is available", async () => {
		const calls: string[] = [];
		const logMessages: string[] = [];
		const stop = await startRouteTelemetryMaintenanceLoop({
			projectRoot: "/repo",
			config: createDefaultConfig("/repo"),
			sessionId: "startup-loop-test",
			logger: {
				log: async (_scope, _level, message) => {
					logMessages.push(message);
				},
			},
			loadRuntimeContext: async () =>
				({
					routing: null,
					connection: {
						projectName: "repo",
						composeFile: "/repo/.mimirmesh/runtime/docker-compose.yml",
						updatedAt: new Date().toISOString(),
						startedAt: new Date().toISOString(),
						mounts: {},
						services: ["mm-postgres"],
						bridgePorts: {},
					},
				}) as never,
			openStore: async () =>
				({
					loadMaintenanceState: async () => ({
						repoId: "repo",
						lastStartedAt: null,
						lastCompletedAt: null,
						lastSuccessfulAt: null,
						lastCompactedThrough: null,
						status: "idle",
						lagSeconds: 0,
						lastError: null,
						lockOwner: null,
					}),
					close: async () => {},
				}) as never,
			runMaintenance: async () => {
				calls.push("run");
				return {
					acquired: true,
					progress: {
						closedBucketCount: 1,
						remainingBucketCount: 0,
						lastProcessedBucketEnd: "2026-03-28T12:15:00.000Z",
					},
					affectedSourceLabels: ["adaptive"],
					maintenanceState: {
						repoId: "repo",
						lastStartedAt: "2026-03-28T12:15:00.000Z",
						lastCompletedAt: "2026-03-28T12:15:01.000Z",
						lastSuccessfulAt: "2026-03-28T12:15:01.000Z",
						lastCompactedThrough: "2026-03-28T12:15:00.000Z",
						status: "idle",
						lagSeconds: 0,
						lastError: null,
						lockOwner: null,
					},
				};
			},
			cadenceMs: 10,
		});

		try {
			await delay(35);
		} finally {
			await stop();
		}

		expect(calls.length).toBeGreaterThanOrEqual(2);
		expect(
			logMessages.some((message) =>
				message.includes("Route telemetry maintenance startup completed"),
			),
		).toBe(true);
	});
});
