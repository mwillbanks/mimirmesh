import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createDefaultConfig, writeConfig } from "@mimirmesh/config";
import {
	openRouteTelemetryStore,
	persistConnection,
	persistRoutingTable,
	runRouteTelemetryMaintenance,
} from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";
import type { PresentationProfile } from "@mimirmesh/ui";
import { startSkillRegistryRuntime } from "../../../../tests/_helpers/skills-runtime";
import McpRouteHintsCommand from "../../src/commands/mcp/route-hints";
import { renderInkUntilExit } from "../../src/testing/render-ink";

const machinePresentation: PresentationProfile = {
	mode: "direct-machine",
	interactive: false,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "wide",
};

afterEach(() => {
	delete process.env.MIMIRMESH_PROJECT_ROOT;
	delete process.env.MIMIRMESH_SESSION_ID;
});

describe("route telemetry command", () => {
	test("renders deterministic profile inspection payloads with freshness and maintenance fields", async () => {
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
			process.env.MIMIRMESH_SESSION_ID = "route-hints-command";
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
					sessionId: "route-hints-command",
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
					latencyMs: 110,
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
					lockOwner: "route-hints-command:test",
					now: maintenanceNow,
				});
			} finally {
				await store.close();
			}

			const output = await renderInkUntilExit(
				<McpRouteHintsCommand
					args={["search_code"]}
					options={{
						route: "srclight:hybrid_search",
						profile: "profile-search",
						includeRollups: true,
					}}
					presentation={machinePresentation}
				/>,
			);

			expect(output).toContain('"profileScope": "profile"');
			expect(output).toContain('"engine": "srclight"');
			expect(output).toContain('"engineTool": "hybrid_search"');
			expect(output).toContain('"telemetryHealth": {');
			expect(output).toContain('"state": "ready"');
			expect(output).toContain('"compactionProgress": {');
			expect(output).toContain('"closedBucketCount": 0');
			expect(output).toContain('"affectedSourceLabels": [');
			expect(output).toContain('"sparse"');
			expect(output).toContain('"freshnessState": "current"');
			expect(output).toContain('"freshnessAgeSeconds"');
			expect(output).toContain('"recentRollups": {');
			expect(output).not.toContain("sanitizedArgumentSummary");
			expect(output).not.toContain("requestFingerprint");
		} finally {
			await runtime.stop();
			await rm(repo, { recursive: true, force: true });
		}
	}, 120_000);
});
