import type { McpRoutingHints, MimirmeshConfig } from "@mimirmesh/config";
import {
	type RouteExecutionStrategy,
	type RouteHintSnapshot,
	type RouteHintSourceLabel,
	type RouteHintSourceMode,
	type RouteSeedHint,
	sourceLabelForMode,
} from "@mimirmesh/runtime";
import type { RouteHintScoreBreakdown, RoutingEngineRoute, UnifiedToolName } from "../types";

export const defaultAdaptiveRouteHintAllowlist: UnifiedToolName[] = ["search_code", "find_symbol"];

export const supportedAdaptiveRouteHintTools: UnifiedToolName[] = ["search_code", "find_symbol"];

export const executionStrategyForRoute = (
	route: Pick<RoutingEngineRoute, "executionStrategy">,
): RouteExecutionStrategy => route.executionStrategy ?? "fanout";

export const seedHintForRoute = (
	route: Pick<RoutingEngineRoute, "seedHint">,
): RouteSeedHint | null => route.seedHint ?? null;

export const resolveAdaptiveRouteHintAllowlist = (
	config: Pick<MimirmeshConfig, "mcp">,
): {
	defaultAllowlist: UnifiedToolName[];
	effectiveAllowlist: UnifiedToolName[];
	overrideWarnings: string[];
} => {
	const routingHints: McpRoutingHints | undefined = config.mcp.routingHints;
	const include = routingHints?.adaptiveSubset.include ?? [];
	const exclude = routingHints?.adaptiveSubset.exclude ?? [];
	const supported = new Set<UnifiedToolName>(supportedAdaptiveRouteHintTools);
	const overrideWarnings = [
		...include
			.filter((entry): entry is string => !supported.has(entry as UnifiedToolName))
			.map((entry) => `Ignoring unsupported adaptive include override '${entry}'.`),
		...exclude
			.filter((entry): entry is string => !supported.has(entry as UnifiedToolName))
			.map((entry) => `Ignoring unsupported adaptive exclude override '${entry}'.`),
	];

	const effective = new Set<UnifiedToolName>(defaultAdaptiveRouteHintAllowlist);
	for (const tool of include) {
		if (supported.has(tool as UnifiedToolName)) {
			effective.add(tool as UnifiedToolName);
		}
	}
	for (const tool of exclude) {
		if (supported.has(tool as UnifiedToolName)) {
			effective.delete(tool as UnifiedToolName);
		}
	}

	return {
		defaultAllowlist: [...defaultAdaptiveRouteHintAllowlist],
		effectiveAllowlist: [...effective],
		overrideWarnings,
	};
};

export const routeHintModeLabel = (mode: RouteHintSourceMode): RouteHintSourceLabel =>
	sourceLabelForMode(mode);

export const scoreRouteHintSnapshot = (
	snapshot: RouteHintSnapshot,
	seedHint: RouteSeedHint,
): RouteHintScoreBreakdown => {
	const seededTokens = Math.max(1, seedHint.estimatedInputTokens + seedHint.estimatedOutputTokens);
	const tokenScore =
		(snapshot.estimatedInputTokens + snapshot.estimatedOutputTokens) / seededTokens;
	const latencyScore = snapshot.estimatedLatencyMs / Math.max(1, seedHint.estimatedLatencyMs);
	const reliabilityPenalty = (1 - snapshot.estimatedSuccessRate) * 3 + snapshot.degradedRate * 1.5;
	const freshnessModifier =
		snapshot.freshnessState === "stale"
			? seedHint.freshnessSensitivity === "high"
				? 0.15
				: seedHint.freshnessSensitivity === "medium"
					? 0.05
					: 0
			: snapshot.freshnessState === "aging" && seedHint.freshnessSensitivity !== "low"
				? 0.05
				: 0;
	const cacheModifier =
		seedHint.cacheAffinity === "high" ? -0.15 : seedHint.cacheAffinity === "medium" ? -0.05 : 0;
	const effectiveCostScore =
		0.45 * tokenScore +
		0.3 * latencyScore +
		0.25 * reliabilityPenalty +
		freshnessModifier +
		cacheModifier;

	return {
		tokenScore,
		latencyScore,
		reliabilityPenalty,
		freshnessModifier,
		cacheModifier,
		effectiveCostScore,
		cacheAffinity: seedHint.cacheAffinity,
		freshnessSensitivity: seedHint.freshnessSensitivity,
	};
};

export const compareHintedRoutes = (left: RouteHintSnapshot, right: RouteHintSnapshot): number => {
	const scoreDelta = left.effectiveCostScore - right.effectiveCostScore;
	if (Math.abs(scoreDelta) >= 0.05) {
		return scoreDelta;
	}
	if (left.confidence !== right.confidence) {
		return right.confidence - left.confidence;
	}
	if (left.staticPriority !== right.staticPriority) {
		return right.staticPriority - left.staticPriority;
	}
	return `${left.engine}:${left.engineTool}`.localeCompare(`${right.engine}:${right.engineTool}`);
};
