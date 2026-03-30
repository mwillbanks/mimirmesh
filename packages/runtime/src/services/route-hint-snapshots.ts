import { buildRouteTelemetrySeedHash, sourceLabelForMode } from "../state/route-telemetry";
import type {
	RouteHintFreshnessState,
	RouteHintSnapshot,
	RouteHintSourceMode,
	RouteRollupBucket,
	RouteSeedHint,
	UnifiedRoute,
} from "../types";

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

export const freshnessStateForAgeSeconds = (ageSeconds: number | null): RouteHintFreshnessState => {
	if (ageSeconds == null) {
		return "unknown";
	}
	if (ageSeconds <= 24 * 60 * 60) {
		return "current";
	}
	if (ageSeconds <= 72 * 60 * 60) {
		return "aging";
	}
	return "stale";
};

export const recencyScoreForAgeSeconds = (ageSeconds: number | null): number => {
	if (ageSeconds == null) {
		return 0;
	}
	if (ageSeconds <= 24 * 60 * 60) {
		return 1;
	}
	if (ageSeconds <= 72 * 60 * 60) {
		return 0.5;
	}
	if (ageSeconds <= 7 * 24 * 60 * 60) {
		return 0.25;
	}
	return 0;
};

export const sampleScoreForCount = (sampleCount: number): number => clamp(sampleCount / 50, 0, 1);

export const stabilityScoreForRates = (failedRate: number, degradedRate: number): number =>
	clamp(1 - (failedRate * 1.5 + degradedRate), 0, 1);

export const confidenceForMetrics = (options: {
	sampleCount: number;
	failedRate: number;
	degradedRate: number;
	ageSeconds: number | null;
}): number =>
	clamp(
		0.5 * sampleScoreForCount(options.sampleCount) +
			0.25 * recencyScoreForAgeSeconds(options.ageSeconds) +
			0.25 * stabilityScoreForRates(options.failedRate, options.degradedRate),
	);

export const sourceModeForMetrics = (options: {
	sampleCount: number;
	ageSeconds: number | null;
	confidence: number;
	successRate: number;
	degradedRate: number;
}): RouteHintSourceMode => {
	if (options.sampleCount === 0) {
		return "static";
	}
	if (options.ageSeconds != null && options.ageSeconds > 72 * 60 * 60) {
		return "stale";
	}
	if (options.sampleCount < 15) {
		return "insufficient-data";
	}
	if (
		options.confidence >= 0.75 &&
		options.sampleCount >= 50 &&
		options.successRate >= 0.9 &&
		options.degradedRate <= 0.25 &&
		(options.ageSeconds == null || options.ageSeconds <= 24 * 60 * 60)
	) {
		return "adaptive";
	}
	return "mixed";
};

export const effectiveCostScoreForSnapshot = (options: {
	seedHint: RouteSeedHint;
	estimatedInputTokens: number;
	estimatedOutputTokens: number;
	estimatedLatencyMs: number;
	successRate: number;
	degradedRate: number;
	freshnessState: RouteHintFreshnessState;
}): number => {
	const seededTokens = Math.max(
		1,
		options.seedHint.estimatedInputTokens + options.seedHint.estimatedOutputTokens,
	);
	const observedTokens = options.estimatedInputTokens + options.estimatedOutputTokens;
	const tokenScore = observedTokens / seededTokens;
	const latencyScore =
		options.estimatedLatencyMs / Math.max(1, options.seedHint.estimatedLatencyMs);
	const reliabilityPenalty = (1 - options.successRate) * 3 + options.degradedRate * 1.5;
	const freshnessModifier =
		options.freshnessState === "stale"
			? options.seedHint.freshnessSensitivity === "high"
				? 0.15
				: options.seedHint.freshnessSensitivity === "medium"
					? 0.05
					: 0
			: 0;
	const cacheModifier =
		options.seedHint.cacheAffinity === "high"
			? -0.15
			: options.seedHint.cacheAffinity === "medium"
				? -0.05
				: 0;
	return (
		0.45 * tokenScore +
		0.3 * latencyScore +
		0.25 * reliabilityPenalty +
		freshnessModifier +
		cacheModifier
	);
};

export const aggregateRollupsForSnapshot = (
	rollups: RouteRollupBucket[],
	seedHint: RouteSeedHint,
): Omit<
	RouteHintSnapshot,
	| "repoId"
	| "unifiedTool"
	| "profileKey"
	| "engine"
	| "engineTool"
	| "executionStrategy"
	| "subsetEligible"
	| "sourceMode"
	| "sourceLabel"
	| "confidence"
	| "freshnessState"
	| "effectiveCostScore"
	| "staticPriority"
	| "lastRefreshedAt"
	| "seedHash"
> & {
	successRate: number;
} => {
	const attemptCount = rollups.reduce((total, bucket) => total + bucket.attemptCount, 0);
	if (attemptCount === 0) {
		return {
			sampleCount: 0,
			freshnessAgeSeconds: null,
			estimatedInputTokens: seedHint.estimatedInputTokens,
			estimatedOutputTokens: seedHint.estimatedOutputTokens,
			estimatedLatencyMs: seedHint.estimatedLatencyMs,
			estimatedSuccessRate: seedHint.expectedSuccessRate,
			successRate: seedHint.expectedSuccessRate,
			degradedRate: 0,
			cacheAffinity: seedHint.cacheAffinity,
			freshnessSensitivity: seedHint.freshnessSensitivity,
			orderingReasonCodes: ["seed_hint"],
			lastObservedAt: null,
		};
	}

	const weighted = <K extends keyof RouteRollupBucket>(field: K): number =>
		rollups.reduce((total, bucket) => total + Number(bucket[field] ?? 0) * bucket.attemptCount, 0) /
		attemptCount;

	const successCount = rollups.reduce((total, bucket) => total + bucket.successCount, 0);
	const degradedCount = rollups.reduce((total, bucket) => total + bucket.degradedCount, 0);
	const lastObservedAt =
		rollups
			.map((bucket) => bucket.lastObservedAt)
			.filter(Boolean)
			.sort()
			.at(-1) ?? null;
	const orderingReasonCodes = Object.entries(
		rollups.reduce<Record<string, number>>((counts, bucket) => {
			for (const [code, count] of Object.entries(bucket.orderingReasonCounts)) {
				counts[code] = (counts[code] ?? 0) + count;
			}
			return counts;
		}, {}),
	)
		.sort((left, right) => right[1] - left[1])
		.map(([code]) => code);

	return {
		sampleCount: attemptCount,
		freshnessAgeSeconds: lastObservedAt
			? Math.max(0, Math.round((Date.now() - Date.parse(lastObservedAt)) / 1000))
			: null,
		estimatedInputTokens: weighted("avgEstimatedInputTokens"),
		estimatedOutputTokens: weighted("avgEstimatedOutputTokens"),
		estimatedLatencyMs: weighted("avgLatencyMs"),
		estimatedSuccessRate: successCount / attemptCount,
		successRate: successCount / attemptCount,
		degradedRate: degradedCount / attemptCount,
		cacheAffinity: seedHint.cacheAffinity,
		freshnessSensitivity: seedHint.freshnessSensitivity,
		orderingReasonCodes:
			orderingReasonCodes.length > 0 ? orderingReasonCodes : ["telemetry_rollup"],
		lastObservedAt,
	};
};

export const deriveRouteHintSnapshot = (options: {
	repoId: string;
	unifiedTool: string;
	profileKey: string;
	route: UnifiedRoute;
	seedHint: RouteSeedHint;
	rollups: RouteRollupBucket[];
	subsetEligible: boolean;
	now?: Date;
}): RouteHintSnapshot => {
	const aggregate = aggregateRollupsForSnapshot(options.rollups, options.seedHint);
	const freshnessState = freshnessStateForAgeSeconds(aggregate.freshnessAgeSeconds);
	const failedRate =
		aggregate.sampleCount === 0
			? 1 - options.seedHint.expectedSuccessRate
			: clamp(1 - aggregate.estimatedSuccessRate - aggregate.degradedRate, 0, 1);
	const confidence = confidenceForMetrics({
		sampleCount: aggregate.sampleCount,
		failedRate,
		degradedRate: aggregate.degradedRate,
		ageSeconds: aggregate.freshnessAgeSeconds,
	});
	const sourceMode = sourceModeForMetrics({
		sampleCount: aggregate.sampleCount,
		ageSeconds: aggregate.freshnessAgeSeconds,
		confidence,
		successRate: aggregate.estimatedSuccessRate,
		degradedRate: aggregate.degradedRate,
	});

	return {
		repoId: options.repoId,
		unifiedTool: options.unifiedTool,
		profileKey: options.profileKey,
		engine: options.route.engine,
		engineTool: options.route.engineTool,
		executionStrategy: options.route.executionStrategy ?? options.seedHint.executionStrategy,
		subsetEligible: options.subsetEligible,
		sourceMode,
		sourceLabel: sourceLabelForMode(sourceMode),
		sampleCount: aggregate.sampleCount,
		confidence,
		freshnessState,
		freshnessAgeSeconds: aggregate.freshnessAgeSeconds,
		estimatedInputTokens: aggregate.estimatedInputTokens,
		estimatedOutputTokens: aggregate.estimatedOutputTokens,
		estimatedLatencyMs: aggregate.estimatedLatencyMs,
		estimatedSuccessRate: aggregate.estimatedSuccessRate,
		degradedRate: aggregate.degradedRate,
		cacheAffinity: aggregate.cacheAffinity,
		freshnessSensitivity: aggregate.freshnessSensitivity,
		effectiveCostScore: effectiveCostScoreForSnapshot({
			seedHint: options.seedHint,
			estimatedInputTokens: aggregate.estimatedInputTokens,
			estimatedOutputTokens: aggregate.estimatedOutputTokens,
			estimatedLatencyMs: aggregate.estimatedLatencyMs,
			successRate: aggregate.estimatedSuccessRate,
			degradedRate: aggregate.degradedRate,
			freshnessState,
		}),
		staticPriority: options.route.priority,
		orderingReasonCodes: aggregate.orderingReasonCodes,
		lastObservedAt: aggregate.lastObservedAt,
		lastRefreshedAt: (options.now ?? new Date()).toISOString(),
		seedHash: buildRouteTelemetrySeedHash(options.seedHint),
	};
};
