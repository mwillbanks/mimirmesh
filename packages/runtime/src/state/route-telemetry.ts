import type { EngineId } from "@mimirmesh/config";
import { buildRepoId, hashDeterministic, stableStringify } from "@mimirmesh/skills";
import type {
	RouteHintSourceLabel,
	RouteHintSourceMode,
	RouteTelemetryMaintenanceProgress,
	RouteTelemetryMaintenanceState,
} from "../types";

export const ROUTE_TELEMETRY_SCHEMA_VERSION = "011_route_telemetry_v1";
export const ROUTE_TELEMETRY_RAW_RETENTION_DAYS = 7;
export const ROUTE_TELEMETRY_COMPACTION_CADENCE_MINUTES = 15;
export const ROUTE_TELEMETRY_STALE_AFTER_HOURS = 72;
export const ROUTE_TELEMETRY_ADAPTIVE_SAMPLE_MINIMUM = 50;
export const ROUTE_TELEMETRY_MIXED_SAMPLE_MINIMUM = 15;

export const ROUTE_TELEMETRY_ROLLUP_RETENTION = {
	last15mHours: 48,
	last6hDays: 14,
	last1dDays: 90,
} as const;

export type RouteTelemetryBucketTier = "last15m" | "last6h" | "last1d";

export type RouteTelemetryScope =
	| {
			scope: "repo";
	  }
	| {
			scope: "tool";
			unifiedTool: string;
	  }
	| {
			scope: "route";
			unifiedTool: string;
			engine: EngineId;
			engineTool: string;
	  };

export const routeTelemetryRollupTable = (tier: RouteTelemetryBucketTier): string => {
	switch (tier) {
		case "last15m":
			return "route_rollup_15m";
		case "last6h":
			return "route_rollup_6h";
		case "last1d":
			return "route_rollup_1d";
	}
};

export const buildRouteTelemetryRepoId = (projectRoot: string): string => buildRepoId(projectRoot);

export const buildRouteTelemetrySeedHash = (seedHint: unknown): string =>
	hashDeterministic(seedHint);

export const buildRouteTelemetryLockKey = (repoId: string): bigint =>
	BigInt.asIntN(
		64,
		BigInt(`0x${hashDeterministic({ namespace: "route-telemetry", repoId }).slice(0, 16)}`),
	);

export const sourceLabelForMode = (mode: RouteHintSourceMode): RouteHintSourceLabel => {
	switch (mode) {
		case "static":
			return "seed-only";
		case "insufficient-data":
			return "sparse";
		case "mixed":
			return "mixed";
		case "adaptive":
			return "adaptive";
		case "stale":
			return "stale";
	}
};

export const emptyRouteTelemetryMaintenanceProgress = (): RouteTelemetryMaintenanceProgress => ({
	closedBucketCount: 0,
	remainingBucketCount: 0,
	lastProcessedBucketEnd: null,
});

export const emptyRouteTelemetryMaintenanceState = (
	repoId: string,
): RouteTelemetryMaintenanceState => ({
	repoId,
	lastStartedAt: null,
	lastCompletedAt: null,
	lastSuccessfulAt: null,
	lastCompactedThrough: null,
	status: "idle",
	lagSeconds: 0,
	lastError: null,
	lockOwner: null,
});

export const stableJson = (value: unknown): string => stableStringify(value);
