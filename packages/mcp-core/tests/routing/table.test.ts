import { describe, expect, test } from "bun:test";

import type { RouteHintSnapshot, RoutingTable } from "@mimirmesh/runtime";

import { publishedPassthroughToolName, retiredPassthroughAliasFor } from "../../src/passthrough";
import { passthroughRouteFor, unifiedRoutesFor } from "../../src/routing/table";

const table: RoutingTable = {
	generatedAt: new Date().toISOString(),
	passthrough: [
		{
			publicTool: "mimirmesh.srclight.hybrid_search",
			engine: "srclight",
			engineTool: "hybrid_search",
			publication: {
				canonicalEngineId: "srclight",
				publishedTool: "srclight_hybrid_search",
				retiredAliases: ["mimirmesh.srclight.hybrid_search"],
			},
		},
	],
	unified: [
		{
			unifiedTool: "search_code",
			engine: "document-mcp",
			engineTool: "search_documents",
			priority: 90,
		},
		{
			unifiedTool: "search_code",
			engine: "srclight",
			engineTool: "search_code",
			priority: 100,
		},
	],
};

describe("mcp routing table", () => {
	test("returns unified routes sorted by priority", () => {
		const routes = unifiedRoutesFor(table, "search_code");
		expect(routes.length).toBe(2);
		expect(routes[0]?.engine).toBe("srclight");
	});

	test("returns passthrough route by public tool", () => {
		const route = passthroughRouteFor(table, "srclight_hybrid_search");
		expect(route?.engineTool).toBe("hybrid_search");
	});

	test("returns the published passthrough name from publication metadata", () => {
		const route = table.passthrough[0];
		expect(route).toBeDefined();
		if (!route) {
			throw new Error("expected a passthrough route");
		}
		expect(publishedPassthroughToolName(route)).toBe("srclight_hybrid_search");
	});

	test("matches retired passthrough aliases separately from published names", () => {
		const retired = retiredPassthroughAliasFor(table, "mimirmesh.srclight.hybrid_search");
		expect(retired?.replacementName).toBe("srclight_hybrid_search");
	});

	test("reorders eligible routes when mixed telemetry materially beats static seed ordering", () => {
		const snapshots: RouteHintSnapshot[] = [
			{
				repoId: "repo",
				unifiedTool: "search_code",
				profileKey: "profile",
				engine: "document-mcp",
				engineTool: "search_documents",
				executionStrategy: "fallback-only",
				subsetEligible: true,
				sourceMode: "mixed",
				sourceLabel: "mixed",
				sampleCount: 24,
				confidence: 0.72,
				freshnessState: "current",
				freshnessAgeSeconds: 30,
				estimatedInputTokens: 50,
				estimatedOutputTokens: 14,
				estimatedLatencyMs: 80,
				estimatedSuccessRate: 0.98,
				degradedRate: 0,
				cacheAffinity: "medium",
				freshnessSensitivity: "medium",
				effectiveCostScore: 0.35,
				staticPriority: 90,
				orderingReasonCodes: ["adaptive_cost"],
				lastObservedAt: new Date().toISOString(),
				lastRefreshedAt: new Date().toISOString(),
				seedHash: "left-seed",
			},
			{
				repoId: "repo",
				unifiedTool: "search_code",
				profileKey: "profile",
				engine: "srclight",
				engineTool: "search_code",
				executionStrategy: "fallback-only",
				subsetEligible: true,
				sourceMode: "static",
				sourceLabel: "seed-only",
				sampleCount: 0,
				confidence: 0.2,
				freshnessState: "unknown",
				freshnessAgeSeconds: null,
				estimatedInputTokens: 80,
				estimatedOutputTokens: 24,
				estimatedLatencyMs: 180,
				estimatedSuccessRate: 0.9,
				degradedRate: 0,
				cacheAffinity: "medium",
				freshnessSensitivity: "medium",
				effectiveCostScore: 0.62,
				staticPriority: 100,
				orderingReasonCodes: ["seed_hint"],
				lastObservedAt: null,
				lastRefreshedAt: new Date().toISOString(),
				seedHash: "right-seed",
			},
		];

		const routes = unifiedRoutesFor(table, "search_code", { hintSnapshots: snapshots });
		expect(routes[0]?.engine).toBe("document-mcp");
	});
});
