import {
	emptyRouteTelemetryMaintenanceProgress,
	ROUTE_TELEMETRY_COMPACTION_CADENCE_MINUTES,
	ROUTE_TELEMETRY_RAW_RETENTION_DAYS,
	ROUTE_TELEMETRY_ROLLUP_RETENTION,
} from "../state/route-telemetry";
import type { RouteHintSourceLabel, RouteTelemetryMaintenanceState } from "../types";

export type RouteTelemetryHealthSummary = {
	state: "ready" | "behind" | "degraded" | "unavailable";
	lastSuccessfulCompactionAt: string | null;
	lagSeconds: number;
	warnings: string[];
	maintenanceStatus: RouteTelemetryMaintenanceState & {
		compactionProgress: {
			closedBucketCount: number;
			remainingBucketCount: number;
			lastProcessedBucketEnd: string | null;
		};
		rawRetentionDays: number;
		rollupRetention: typeof ROUTE_TELEMETRY_ROLLUP_RETENTION;
		overdueBySeconds: number;
		affectedSourceLabels: RouteHintSourceLabel[];
	};
};

export const summarizeRouteTelemetryHealth = (options: {
	maintenanceState: RouteTelemetryMaintenanceState | null;
	invalidOverrideWarnings?: string[];
	affectedSourceLabels?: RouteHintSourceLabel[];
	progress?: RouteTelemetryHealthSummary["maintenanceStatus"]["compactionProgress"];
	now?: Date;
	unavailableReason?: string | null;
}): RouteTelemetryHealthSummary => {
	const now = options.now ?? new Date();
	const maintenanceState = options.maintenanceState ?? {
		repoId: "unknown",
		lastStartedAt: null,
		lastCompletedAt: null,
		lastSuccessfulAt: null,
		lastCompactedThrough: null,
		status: "idle",
		lagSeconds: 0,
		lastError: null,
		lockOwner: null,
	};
	const cadenceSeconds = ROUTE_TELEMETRY_COMPACTION_CADENCE_MINUTES * 60;
	const lastCompletedAtMs = maintenanceState.lastCompletedAt
		? Date.parse(maintenanceState.lastCompletedAt)
		: 0;
	const overdueBySeconds =
		lastCompletedAtMs === 0
			? cadenceSeconds
			: Math.max(0, Math.floor((now.getTime() - lastCompletedAtMs) / 1000) - cadenceSeconds);
	const warnings = [...(options.invalidOverrideWarnings ?? [])];
	if (maintenanceState.lastError) {
		warnings.push(maintenanceState.lastError);
	}
	if (overdueBySeconds > 0) {
		warnings.push("Telemetry maintenance is behind the expected cadence.");
	}
	if (options.unavailableReason) {
		warnings.push(options.unavailableReason);
	}

	const state = options.unavailableReason
		? "unavailable"
		: maintenanceState.status === "failed" || maintenanceState.status === "degraded"
			? "degraded"
			: overdueBySeconds > 0
				? "behind"
				: "ready";

	return {
		state,
		lastSuccessfulCompactionAt: maintenanceState.lastSuccessfulAt,
		lagSeconds: maintenanceState.lagSeconds,
		warnings,
		maintenanceStatus: {
			...maintenanceState,
			compactionProgress: options.progress ?? emptyRouteTelemetryMaintenanceProgress(),
			rawRetentionDays: ROUTE_TELEMETRY_RAW_RETENTION_DAYS,
			rollupRetention: ROUTE_TELEMETRY_ROLLUP_RETENTION,
			overdueBySeconds,
			affectedSourceLabels: [...new Set(options.affectedSourceLabels ?? [])],
		},
	};
};
