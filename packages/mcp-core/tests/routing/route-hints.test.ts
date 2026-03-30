import { describe, expect, test } from "bun:test";

import type { RouteHintSnapshot, RouteSeedHint } from "@mimirmesh/runtime";

import {
	compareHintedRoutes,
	resolveAdaptiveRouteHintAllowlist,
	scoreRouteHintSnapshot,
} from "../../src/routing/hints";

const seedHint: RouteSeedHint = {
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
};

const snapshot = (overrides: Partial<RouteHintSnapshot>): RouteHintSnapshot => ({
	repoId: "repo",
	unifiedTool: "search_code",
	profileKey: "profile",
	engine: "srclight",
	engineTool: "hybrid_search",
	executionStrategy: "fallback-only",
	subsetEligible: true,
	sourceMode: "adaptive",
	sourceLabel: "adaptive",
	sampleCount: 80,
	confidence: 0.88,
	freshnessState: "current",
	freshnessAgeSeconds: 120,
	estimatedInputTokens: 80,
	estimatedOutputTokens: 20,
	estimatedLatencyMs: 140,
	estimatedSuccessRate: 0.97,
	degradedRate: 0.01,
	cacheAffinity: "high",
	freshnessSensitivity: "medium",
	effectiveCostScore: 0.4,
	staticPriority: 150,
	orderingReasonCodes: ["adaptive_cost"],
	lastObservedAt: new Date().toISOString(),
	lastRefreshedAt: new Date().toISOString(),
	seedHash: "seed-hash",
	...overrides,
});

describe("route hint scoring", () => {
	test("resolves the effective allowlist with include, exclude, and invalid warnings", () => {
		const result = resolveAdaptiveRouteHintAllowlist({
			mcp: {
				toolSurface: {
					compressionLevel: "balanced",
					coreEngineGroups: [],
					deferredEngineGroups: ["srclight", "document-mcp", "mcp-adr-analysis-server"],
					deferredVisibility: "summary",
					fullSchemaAccess: true,
					refreshPolicy: "explicit",
					allowInvocationLazyLoad: true,
				},
				routingHints: {
					adaptiveSubset: {
						include: ["find_symbol", "evaluate_codebase"],
						exclude: ["search_code", "document_architecture"],
					},
				},
			},
		});

		expect(result.defaultAllowlist).toEqual(["search_code", "find_symbol"]);
		expect(result.effectiveAllowlist).toEqual(["find_symbol"]);
		expect(result.overrideWarnings).toEqual([
			"Ignoring unsupported adaptive include override 'evaluate_codebase'.",
			"Ignoring unsupported adaptive exclude override 'document_architecture'.",
		]);
	});

	test("scores snapshots with token, latency, reliability, freshness, and cache modifiers", () => {
		const breakdown = scoreRouteHintSnapshot(
			snapshot({
				estimatedInputTokens: 70,
				estimatedOutputTokens: 15,
				estimatedLatencyMs: 120,
				estimatedSuccessRate: 0.94,
				degradedRate: 0.03,
				freshnessState: "aging",
			}),
			seedHint,
		);

		expect(breakdown.tokenScore).toBeLessThan(1);
		expect(breakdown.latencyScore).toBeLessThan(1);
		expect(breakdown.reliabilityPenalty).toBeGreaterThan(0);
		expect(breakdown.cacheModifier).toBeLessThan(0);
		expect(breakdown.effectiveCostScore).toBeLessThan(1);
	});

	test("breaks ties by confidence, then static priority, then lexical route identity", () => {
		const left = snapshot({
			engineTool: "hybrid_search",
			effectiveCostScore: 0.5,
			confidence: 0.8,
			staticPriority: 150,
		});
		const right = snapshot({
			engineTool: "semantic_search",
			effectiveCostScore: 0.52,
			confidence: 0.7,
			staticPriority: 145,
		});

		expect(compareHintedRoutes(left, right)).toBeLessThan(0);
		expect(
			compareHintedRoutes(
				snapshot({
					engineTool: "hybrid_search",
					effectiveCostScore: 0.5,
					confidence: 0.8,
					staticPriority: 140,
				}),
				snapshot({
					engineTool: "semantic_search",
					effectiveCostScore: 0.5,
					confidence: 0.8,
					staticPriority: 150,
				}),
			),
		).toBeGreaterThan(0);
	});
});
