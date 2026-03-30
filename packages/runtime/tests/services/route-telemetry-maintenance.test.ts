import { describe, expect, test } from "bun:test";

import { createDefaultConfig } from "@mimirmesh/config";
import { createFixtureCopy } from "@mimirmesh/testing";
import { startSkillRegistryRuntime } from "../../../../tests/_helpers/skills-runtime";
import { runRouteTelemetryMaintenance } from "../../src/services/route-telemetry-maintenance";
import { openRouteTelemetryStore } from "../../src/services/route-telemetry-store";
import { persistRoutingTable } from "../../src/state/io";

describe("route telemetry maintenance", () => {
	test("compacts raw events into rollups, refreshes snapshots, prunes old data, and stays idempotent", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);
		const runtime = await startSkillRegistryRuntime(repo, config);
		if (!runtime.available) {
			return;
		}

		try {
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
							estimatedInputTokens: 100,
							estimatedOutputTokens: 40,
							estimatedLatencyMs: 300,
							expectedSuccessRate: 0.96,
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
							estimatedInputTokens: 84,
							estimatedOutputTokens: 28,
							estimatedLatencyMs: 220,
							expectedSuccessRate: 0.93,
							cacheAffinity: "medium",
							freshnessSensitivity: "high",
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
				const profileKey = "profile-search";
				const event = (
					overrides: Partial<Parameters<typeof store.recordRouteExecutionEvent>[0]>,
				) => ({
					eventId: crypto.randomUUID(),
					repoId: store.repoId,
					occurredAt: "2026-03-28T12:00:00.000Z",
					sessionId: "test-session",
					requestCorrelationId: null,
					unifiedTool: "search_code",
					profileKey,
					sanitizedArgumentSummary: {
						shapeVersion: 1,
						queryClass: "free-text" as const,
						hasPath: false,
						limitBand: "medium" as const,
						promptLengthBand: "short" as const,
						identifierLike: false,
						additionalFlags: {},
					},
					requestFingerprint: "fingerprint-search",
					engine: "srclight" as const,
					engineTool: "hybrid_search",
					executionStrategy: "fallback-only" as const,
					staticPriority: 150,
					attemptIndex: 1,
					outcome: "success" as const,
					failureClassification: null,
					latencyMs: 140,
					estimatedInputTokens: 100,
					estimatedOutputTokens: 40,
					inputBytes: 100,
					outputBytes: 180,
					resultItemCount: 1,
					hintSourceModeAtExecution: "static" as const,
					hintConfidenceAtExecution: 0,
					effectiveCostScoreAtExecution: 0,
					orderingReasonCodes: ["seed_hint", "static_priority"],
					createdAt: "2026-03-28T12:00:00.000Z",
					...overrides,
				});

				await store.recordRouteExecutionEvent(event({}));
				await store.recordRouteExecutionEvent(
					event({
						engineTool: "semantic_search",
						staticPriority: 145,
						latencyMs: 90,
						estimatedInputTokens: 84,
						estimatedOutputTokens: 28,
					}),
				);
				await store.recordRouteExecutionEvent(
					event({
						occurredAt: "2026-03-18T12:00:00.000Z",
						createdAt: "2026-03-18T12:00:00.000Z",
						engineTool: "semantic_search",
						staticPriority: 145,
					}),
				);

				const firstRun = await runRouteTelemetryMaintenance({
					store,
					lockOwner: "test-maintenance",
					now: new Date("2026-03-28T12:15:00.000Z"),
				});
				expect(firstRun.acquired).toBe(true);
				expect(firstRun.progress.closedBucketCount).toBeGreaterThan(0);

				const rawEvents = await store.listRouteExecutionEvents({ unifiedTool: "search_code" });
				expect(
					rawEvents.every(
						(entry) => Date.parse(entry.occurredAt) >= Date.parse("2026-03-21T12:15:00.000Z"),
					),
				).toBe(true);

				const rollups15m = await store.listRollups({
					tier: "last15m",
					unifiedTool: "search_code",
					profileKey,
				});
				const snapshots = await store.listRouteHintSnapshots({
					unifiedTool: "search_code",
					profileKey,
				});
				expect(rollups15m.length).toBeGreaterThan(0);
				expect(snapshots.length).toBe(2);

				const secondRun = await runRouteTelemetryMaintenance({
					store,
					lockOwner: "test-maintenance",
					now: new Date("2026-03-28T12:15:00.000Z"),
				});
				const rollups15mAfter = await store.listRollups({
					tier: "last15m",
					unifiedTool: "search_code",
					profileKey,
				});

				expect(secondRun.acquired).toBe(true);
				expect(rollups15mAfter).toHaveLength(rollups15m.length);
			} finally {
				await store.close();
			}
		} finally {
			await runtime.stop();
		}
	}, 120_000);
});
