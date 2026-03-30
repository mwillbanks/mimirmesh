import { describe, expect, test } from "bun:test";

import { createDefaultConfig } from "@mimirmesh/config";
import { createFixtureCopy } from "@mimirmesh/testing";
import { startSkillRegistryRuntime } from "../../../../tests/_helpers/skills-runtime";
import { openRouteTelemetryStore } from "../../src/services/route-telemetry-store";
import { ensureRouteTelemetrySchema } from "../../src/state/route-telemetry-migrations";

describe("route telemetry migrations", () => {
	test("boots the telemetry schema and persists sanitized route execution events", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);
		const runtime = await startSkillRegistryRuntime(repo, config);
		if (!runtime.available) {
			return;
		}

		try {
			const schema = await ensureRouteTelemetrySchema(config);
			expect(schema.sql).not.toBeNull();

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
					sessionId: "test-session",
					requestCorrelationId: null,
					unifiedTool: "search_code",
					profileKey: "profile-1",
					sanitizedArgumentSummary: {
						shapeVersion: 1,
						queryClass: "free-text",
						hasPath: false,
						limitBand: "medium",
						promptLengthBand: "short",
						identifierLike: false,
						additionalFlags: {
							hasContext: false,
						},
					},
					requestFingerprint: "fingerprint-1",
					engine: "srclight",
					engineTool: "hybrid_search",
					executionStrategy: "fallback-only",
					staticPriority: 150,
					attemptIndex: 1,
					outcome: "success",
					failureClassification: null,
					latencyMs: 120,
					estimatedInputTokens: 100,
					estimatedOutputTokens: 40,
					inputBytes: 128,
					outputBytes: 256,
					resultItemCount: 1,
					hintSourceModeAtExecution: "static",
					hintConfidenceAtExecution: 0,
					effectiveCostScoreAtExecution: 0,
					orderingReasonCodes: ["seed_hint", "static_priority"],
					createdAt: "2026-03-28T12:00:00.000Z",
				});

				const events = await store.listRouteExecutionEvents({
					unifiedTool: "search_code",
					profileKey: "profile-1",
				});

				expect(events).toHaveLength(1);
				expect(events[0]?.sanitizedArgumentSummary).toEqual({
					shapeVersion: 1,
					queryClass: "free-text",
					hasPath: false,
					limitBand: "medium",
					promptLengthBand: "short",
					identifierLike: false,
					additionalFlags: {
						hasContext: false,
					},
				});
				expect(Object.hasOwn(events[0] ?? {}, "query")).toBe(false);
			} finally {
				await store.close();
			}
		} finally {
			await runtime.stop();
		}
	}, 120_000);
});
