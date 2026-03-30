import { describe, expect, test } from "bun:test";

import { createDefaultConfig } from "@mimirmesh/config";
import { createFixtureCopy } from "@mimirmesh/testing";
import { startSkillRegistryRuntime } from "../../../../tests/_helpers/skills-runtime";
import { openRouteTelemetryStore } from "../../src/services/route-telemetry-store";
import { collectRouteTelemetryRuntimeHealth } from "../../src/services/runtime-lifecycle";
import { persistRoutingTable } from "../../src/state/io";

describe("runtime lifecycle route telemetry health", () => {
	test("performs catch-up maintenance and reports route telemetry health", async () => {
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
							estimatedInputTokens: 96,
							estimatedOutputTokens: 24,
							estimatedLatencyMs: 180,
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
					occurredAt: "2026-03-28T12:00:00.000Z",
					sessionId: "runtime-status",
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
					latencyMs: 140,
					estimatedInputTokens: 96,
					estimatedOutputTokens: 24,
					inputBytes: 120,
					outputBytes: 180,
					resultItemCount: 1,
					hintSourceModeAtExecution: "static",
					hintConfidenceAtExecution: 0,
					effectiveCostScoreAtExecution: 0,
					orderingReasonCodes: ["seed_hint", "static_priority"],
					createdAt: "2026-03-28T12:00:00.000Z",
				});
				await store.saveMaintenanceState({
					repoId: store.repoId,
					lastStartedAt: "2026-03-27T10:00:00.000Z",
					lastCompletedAt: "2026-03-27T10:00:00.000Z",
					lastSuccessfulAt: "2026-03-27T10:00:00.000Z",
					lastCompactedThrough: "2026-03-27T10:00:00.000Z",
					status: "idle",
					lagSeconds: 86_400,
					lastError: null,
					lockOwner: null,
				});
			} finally {
				await store.close();
			}

			const summary = await collectRouteTelemetryRuntimeHealth({
				projectRoot: repo,
				config,
				lockOwner: "runtime-status:test",
				now: new Date("2026-03-28T12:15:00.000Z"),
			});

			expect(summary.state).toBe("ready");
			expect(summary.lastSuccessfulCompactionAt).toBeTruthy();
			expect(summary.lagSeconds).toBe(0);
			expect(summary.warnings).toEqual([]);

			const verifiedStore = await openRouteTelemetryStore(repo, config);
			expect(verifiedStore).not.toBeNull();
			if (!verifiedStore) {
				throw new Error("expected route telemetry store");
			}
			try {
				const maintenanceState = await verifiedStore.loadMaintenanceState();
				expect(maintenanceState.lastSuccessfulAt).toBeTruthy();
				expect(maintenanceState.lastCompactedThrough).toBe("2026-03-28T12:15:00.000Z");
			} finally {
				await verifiedStore.close();
			}
		} finally {
			await runtime.stop();
		}
	}, 120_000);
});
