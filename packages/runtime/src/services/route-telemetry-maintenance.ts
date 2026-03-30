import { loadRoutingTable } from "../state/io";
import {
	buildRouteTelemetryLockKey,
	emptyRouteTelemetryMaintenanceProgress,
	ROUTE_TELEMETRY_RAW_RETENTION_DAYS,
	ROUTE_TELEMETRY_ROLLUP_RETENTION,
	type RouteTelemetryBucketTier,
	type RouteTelemetryScope,
	routeTelemetryRollupTable,
} from "../state/route-telemetry";
import { resolveRouteTelemetryDatabaseUrl } from "../state/route-telemetry-migrations";
import type {
	RouteExecutionEvent,
	RouteHintSourceLabel,
	RouteRollupBucket,
	RouteTelemetryMaintenanceProgress,
	RouteTelemetryMaintenanceState,
	UnifiedRoute,
} from "../types";
import { deriveRouteHintSnapshot } from "./route-hint-snapshots";
import type { RouteTelemetryStore } from "./route-telemetry-store";

const internalSql = (store: RouteTelemetryStore): Bun.SQL =>
	(store as unknown as { sql: Bun.SQL }).sql;

const advisoryLockSessions = new Map<string, Bun.SQL>();

const bucketMsByTier: Record<RouteTelemetryBucketTier, number> = {
	last15m: 15 * 60 * 1000,
	last6h: 6 * 60 * 60 * 1000,
	last1d: 24 * 60 * 60 * 1000,
};

const tierRetentionMs = (tier: RouteTelemetryBucketTier): number => {
	switch (tier) {
		case "last15m":
			return ROUTE_TELEMETRY_ROLLUP_RETENTION.last15mHours * 60 * 60 * 1000;
		case "last6h":
			return ROUTE_TELEMETRY_ROLLUP_RETENTION.last6hDays * 24 * 60 * 60 * 1000;
		case "last1d":
			return ROUTE_TELEMETRY_ROLLUP_RETENTION.last1dDays * 24 * 60 * 60 * 1000;
	}
};

const floorBucketStart = (value: string, tier: RouteTelemetryBucketTier): string => {
	const timestamp = Date.parse(value);
	const bucketMs = bucketMsByTier[tier];
	return new Date(Math.floor(timestamp / bucketMs) * bucketMs).toISOString();
};

const isInScope = (
	scope: RouteTelemetryScope,
	candidate: {
		unifiedTool: string;
		engine: string;
		engineTool: string;
	},
): boolean => {
	switch (scope.scope) {
		case "repo":
			return true;
		case "tool":
			return candidate.unifiedTool === scope.unifiedTool;
		case "route":
			return (
				candidate.unifiedTool === scope.unifiedTool &&
				candidate.engine === scope.engine &&
				candidate.engineTool === scope.engineTool
			);
	}
};

const routeIdentity = (value: {
	unifiedTool: string;
	profileKey: string;
	engine: string;
	engineTool: string;
	executionStrategy: string;
}) =>
	`${value.unifiedTool}::${value.profileKey}::${value.engine}::${value.engineTool}::${value.executionStrategy}`;

const percentile = (values: number[], percentileRank: number): number => {
	if (values.length === 0) {
		return 0;
	}
	const sorted = [...values].sort((left, right) => left - right);
	const index = Math.min(
		sorted.length - 1,
		Math.max(0, Math.ceil((percentileRank / 100) * sorted.length) - 1),
	);
	return sorted[index] ?? 0;
};

const aggregateEvents = (
	store: RouteTelemetryStore,
	events: RouteExecutionEvent[],
	tier: RouteTelemetryBucketTier,
): RouteRollupBucket[] => {
	const buckets = new Map<
		string,
		{
			bucketStart: string;
			unifiedTool: string;
			profileKey: string;
			engine: RouteExecutionEvent["engine"];
			engineTool: string;
			executionStrategy: RouteExecutionEvent["executionStrategy"];
			latencies: number[];
			attemptCount: number;
			successCount: number;
			degradedCount: number;
			failedCount: number;
			estimatedInputTokens: number;
			estimatedOutputTokens: number;
			inputBytes: number;
			outputBytes: number;
			resultItemCount: number;
			lastObservedAt: string;
			orderingReasonCounts: Record<string, number>;
		}
	>();

	for (const event of events) {
		const bucketStart = floorBucketStart(event.occurredAt, tier);
		const key = `${routeIdentity(event)}::${bucketStart}`;
		const existing = buckets.get(key) ?? {
			bucketStart,
			unifiedTool: event.unifiedTool,
			profileKey: event.profileKey,
			engine: event.engine,
			engineTool: event.engineTool,
			executionStrategy: event.executionStrategy,
			latencies: [],
			attemptCount: 0,
			successCount: 0,
			degradedCount: 0,
			failedCount: 0,
			estimatedInputTokens: 0,
			estimatedOutputTokens: 0,
			inputBytes: 0,
			outputBytes: 0,
			resultItemCount: 0,
			lastObservedAt: event.occurredAt,
			orderingReasonCounts: {},
		};

		existing.latencies.push(event.latencyMs);
		existing.attemptCount += 1;
		existing.successCount += event.outcome === "success" ? 1 : 0;
		existing.degradedCount += event.outcome === "degraded" ? 1 : 0;
		existing.failedCount += event.outcome === "failed" ? 1 : 0;
		existing.estimatedInputTokens += event.estimatedInputTokens;
		existing.estimatedOutputTokens += event.estimatedOutputTokens;
		existing.inputBytes += event.inputBytes;
		existing.outputBytes += event.outputBytes;
		existing.resultItemCount += event.resultItemCount;
		if (Date.parse(event.occurredAt) > Date.parse(existing.lastObservedAt)) {
			existing.lastObservedAt = event.occurredAt;
		}
		for (const code of event.orderingReasonCodes) {
			existing.orderingReasonCounts[code] = (existing.orderingReasonCounts[code] ?? 0) + 1;
		}
		buckets.set(key, existing);
	}

	return [...buckets.values()].map((bucket) => ({
		repoId: store.repoId,
		unifiedTool: bucket.unifiedTool,
		profileKey: bucket.profileKey,
		engine: bucket.engine,
		engineTool: bucket.engineTool,
		executionStrategy: bucket.executionStrategy,
		bucketStart: bucket.bucketStart,
		attemptCount: bucket.attemptCount,
		successCount: bucket.successCount,
		degradedCount: bucket.degradedCount,
		failedCount: bucket.failedCount,
		avgLatencyMs:
			bucket.latencies.reduce((total, latency) => total + latency, 0) /
			Math.max(1, bucket.attemptCount),
		p95LatencyMs: percentile(bucket.latencies, 95),
		avgEstimatedInputTokens: bucket.estimatedInputTokens / Math.max(1, bucket.attemptCount),
		avgEstimatedOutputTokens: bucket.estimatedOutputTokens / Math.max(1, bucket.attemptCount),
		avgInputBytes: bucket.inputBytes / Math.max(1, bucket.attemptCount),
		avgOutputBytes: bucket.outputBytes / Math.max(1, bucket.attemptCount),
		avgResultItemCount: bucket.resultItemCount / Math.max(1, bucket.attemptCount),
		lastObservedAt: bucket.lastObservedAt,
		orderingReasonCounts: bucket.orderingReasonCounts,
	}));
};

const aggregateRollups = (
	store: RouteTelemetryStore,
	rollups: RouteRollupBucket[],
	targetTier: RouteTelemetryBucketTier,
): RouteRollupBucket[] => {
	const buckets = new Map<
		string,
		{
			bucketStart: string;
			unifiedTool: string;
			profileKey: string;
			engine: RouteRollupBucket["engine"];
			engineTool: string;
			executionStrategy: RouteRollupBucket["executionStrategy"];
			attemptCount: number;
			successCount: number;
			degradedCount: number;
			failedCount: number;
			latencyWeighted: number;
			p95LatencyMs: number;
			estimatedInputTokens: number;
			estimatedOutputTokens: number;
			inputBytes: number;
			outputBytes: number;
			resultItemCount: number;
			lastObservedAt: string;
			orderingReasonCounts: Record<string, number>;
		}
	>();

	for (const rollup of rollups) {
		const bucketStart = floorBucketStart(rollup.bucketStart, targetTier);
		const key = `${routeIdentity(rollup)}::${bucketStart}`;
		const existing = buckets.get(key) ?? {
			bucketStart,
			unifiedTool: rollup.unifiedTool,
			profileKey: rollup.profileKey,
			engine: rollup.engine,
			engineTool: rollup.engineTool,
			executionStrategy: rollup.executionStrategy,
			attemptCount: 0,
			successCount: 0,
			degradedCount: 0,
			failedCount: 0,
			latencyWeighted: 0,
			p95LatencyMs: 0,
			estimatedInputTokens: 0,
			estimatedOutputTokens: 0,
			inputBytes: 0,
			outputBytes: 0,
			resultItemCount: 0,
			lastObservedAt: rollup.lastObservedAt,
			orderingReasonCounts: {},
		};

		existing.attemptCount += rollup.attemptCount;
		existing.successCount += rollup.successCount;
		existing.degradedCount += rollup.degradedCount;
		existing.failedCount += rollup.failedCount;
		existing.latencyWeighted += rollup.avgLatencyMs * rollup.attemptCount;
		existing.p95LatencyMs = Math.max(existing.p95LatencyMs, rollup.p95LatencyMs);
		existing.estimatedInputTokens += rollup.avgEstimatedInputTokens * rollup.attemptCount;
		existing.estimatedOutputTokens += rollup.avgEstimatedOutputTokens * rollup.attemptCount;
		existing.inputBytes += rollup.avgInputBytes * rollup.attemptCount;
		existing.outputBytes += rollup.avgOutputBytes * rollup.attemptCount;
		existing.resultItemCount += rollup.avgResultItemCount * rollup.attemptCount;
		if (Date.parse(rollup.lastObservedAt) > Date.parse(existing.lastObservedAt)) {
			existing.lastObservedAt = rollup.lastObservedAt;
		}
		for (const [code, count] of Object.entries(rollup.orderingReasonCounts)) {
			existing.orderingReasonCounts[code] = (existing.orderingReasonCounts[code] ?? 0) + count;
		}
		buckets.set(key, existing);
	}

	return [...buckets.values()].map((bucket) => ({
		repoId: store.repoId,
		unifiedTool: bucket.unifiedTool,
		profileKey: bucket.profileKey,
		engine: bucket.engine,
		engineTool: bucket.engineTool,
		executionStrategy: bucket.executionStrategy,
		bucketStart: bucket.bucketStart,
		attemptCount: bucket.attemptCount,
		successCount: bucket.successCount,
		degradedCount: bucket.degradedCount,
		failedCount: bucket.failedCount,
		avgLatencyMs: bucket.latencyWeighted / Math.max(1, bucket.attemptCount),
		p95LatencyMs: bucket.p95LatencyMs,
		avgEstimatedInputTokens: bucket.estimatedInputTokens / Math.max(1, bucket.attemptCount),
		avgEstimatedOutputTokens: bucket.estimatedOutputTokens / Math.max(1, bucket.attemptCount),
		avgInputBytes: bucket.inputBytes / Math.max(1, bucket.attemptCount),
		avgOutputBytes: bucket.outputBytes / Math.max(1, bucket.attemptCount),
		avgResultItemCount: bucket.resultItemCount / Math.max(1, bucket.attemptCount),
		lastObservedAt: bucket.lastObservedAt,
		orderingReasonCounts: bucket.orderingReasonCounts,
	}));
};

const deleteRollupsForScope = async (
	store: RouteTelemetryStore,
	scope: RouteTelemetryScope,
): Promise<void> => {
	const sql = internalSql(store);
	for (const tier of ["last15m", "last6h", "last1d"] as const) {
		const tableName = routeTelemetryRollupTable(tier);
		if (scope.scope === "repo") {
			continue;
		}
		if (scope.scope === "tool") {
			await sql.unsafe(
				`DELETE FROM ${tableName}
				 WHERE repo_id = $1
				   AND unified_tool = $2`,
				[store.repoId, scope.unifiedTool],
			);
			continue;
		}
		await sql.unsafe(
			`DELETE FROM ${tableName}
			 WHERE repo_id = $1
			   AND unified_tool = $2
			   AND engine = $3
			   AND engine_tool = $4`,
			[store.repoId, scope.unifiedTool, scope.engine, scope.engineTool],
		);
	}

	if (scope.scope === "repo") {
		return;
	}
	if (scope.scope === "tool") {
		await sql`
			DELETE FROM route_hint_snapshots
			WHERE repo_id = ${store.repoId}
				AND unified_tool = ${scope.unifiedTool}
		`;
		return;
	}
	await sql`
		DELETE FROM route_hint_snapshots
		WHERE repo_id = ${store.repoId}
			AND unified_tool = ${scope.unifiedTool}
			AND engine = ${scope.engine}
			AND engine_tool = ${scope.engineTool}
	`;
};

const pruneTelemetry = async (store: RouteTelemetryStore, now: Date): Promise<void> => {
	const rawCutoff = new Date(
		now.getTime() - ROUTE_TELEMETRY_RAW_RETENTION_DAYS * 24 * 60 * 60 * 1000,
	).toISOString();
	await internalSql(store)`
		DELETE FROM route_execution_events
		WHERE repo_id = ${store.repoId}
			AND occurred_at < ${rawCutoff}
	`;

	for (const tier of ["last15m", "last6h", "last1d"] as const) {
		const cutoff = new Date(now.getTime() - tierRetentionMs(tier)).toISOString();
		await internalSql(store).unsafe(
			`DELETE FROM ${routeTelemetryRollupTable(tier)}
			 WHERE repo_id = $1
			   AND bucket_start < $2`,
			[store.repoId, cutoff],
		);
	}
};

const effectiveSourceRollups = (options: {
	last15m: RouteRollupBucket[];
	last6h: RouteRollupBucket[];
	last1d: RouteRollupBucket[];
	now: Date;
}): RouteRollupBucket[] => {
	const cutoff15m =
		options.now.getTime() - ROUTE_TELEMETRY_ROLLUP_RETENTION.last15mHours * 60 * 60 * 1000;
	const cutoff6h =
		options.now.getTime() - ROUTE_TELEMETRY_ROLLUP_RETENTION.last6hDays * 24 * 60 * 60 * 1000;
	return [
		...options.last15m,
		...options.last6h.filter((rollup) => Date.parse(rollup.bucketStart) < cutoff15m),
		...options.last1d.filter((rollup) => Date.parse(rollup.bucketStart) < cutoff6h),
	];
};

const refreshSnapshots = async (options: {
	store: RouteTelemetryStore;
	scope: RouteTelemetryScope;
	now: Date;
	last15m: RouteRollupBucket[];
	last6h: RouteRollupBucket[];
	last1d: RouteRollupBucket[];
}): Promise<RouteHintSourceLabel[]> => {
	const routingTable = await loadRoutingTable(options.store.projectRoot);
	if (!routingTable) {
		return [];
	}

	const profileKeysByTool = new Map<string, Set<string>>();
	for (const rollup of [...options.last15m, ...options.last6h, ...options.last1d]) {
		if (!isInScope(options.scope, rollup)) {
			continue;
		}
		const existing = profileKeysByTool.get(rollup.unifiedTool) ?? new Set<string>();
		existing.add(rollup.profileKey);
		profileKeysByTool.set(rollup.unifiedTool, existing);
	}

	const affectedLabels = new Set<RouteHintSourceLabel>();
	for (const route of routingTable.unified.filter(
		(candidate): candidate is UnifiedRoute & { seedHint: NonNullable<UnifiedRoute["seedHint"]> } =>
			Boolean(candidate.seedHint) && isInScope(options.scope, candidate),
	)) {
		const profileKeys = [...(profileKeysByTool.get(route.unifiedTool) ?? new Set<string>())];
		for (const profileKey of profileKeys) {
			const routeRollups = effectiveSourceRollups({
				last15m: options.last15m.filter(
					(rollup) =>
						rollup.unifiedTool === route.unifiedTool &&
						rollup.profileKey === profileKey &&
						rollup.engine === route.engine &&
						rollup.engineTool === route.engineTool,
				),
				last6h: options.last6h.filter(
					(rollup) =>
						rollup.unifiedTool === route.unifiedTool &&
						rollup.profileKey === profileKey &&
						rollup.engine === route.engine &&
						rollup.engineTool === route.engineTool,
				),
				last1d: options.last1d.filter(
					(rollup) =>
						rollup.unifiedTool === route.unifiedTool &&
						rollup.profileKey === profileKey &&
						rollup.engine === route.engine &&
						rollup.engineTool === route.engineTool,
				),
				now: options.now,
			});
			const siblingRoutes = routingTable.unified.filter(
				(
					candidate,
				): candidate is UnifiedRoute & { seedHint: NonNullable<UnifiedRoute["seedHint"]> } =>
					Boolean(candidate.seedHint) &&
					candidate.unifiedTool === route.unifiedTool &&
					isInScope(options.scope, candidate),
			);
			const snapshots = siblingRoutes.map((candidate) =>
				deriveRouteHintSnapshot({
					repoId: options.store.repoId,
					unifiedTool: candidate.unifiedTool,
					profileKey,
					route: candidate,
					seedHint: candidate.seedHint,
					rollups: effectiveSourceRollups({
						last15m: options.last15m.filter(
							(rollup) =>
								rollup.unifiedTool === candidate.unifiedTool &&
								rollup.profileKey === profileKey &&
								rollup.engine === candidate.engine &&
								rollup.engineTool === candidate.engineTool,
						),
						last6h: options.last6h.filter(
							(rollup) =>
								rollup.unifiedTool === candidate.unifiedTool &&
								rollup.profileKey === profileKey &&
								rollup.engine === candidate.engine &&
								rollup.engineTool === candidate.engineTool,
						),
						last1d: options.last1d.filter(
							(rollup) =>
								rollup.unifiedTool === candidate.unifiedTool &&
								rollup.profileKey === profileKey &&
								rollup.engine === candidate.engine &&
								rollup.engineTool === candidate.engineTool,
						),
						now: options.now,
					}),
					subsetEligible: Boolean(candidate.seedHint.adaptiveEligible),
					now: options.now,
				}),
			);
			await options.store.replaceRouteHintSnapshots(route.unifiedTool, profileKey, snapshots);
			for (const snapshot of snapshots) {
				affectedLabels.add(snapshot.sourceLabel);
			}
			if (routeRollups.length === 0) {
			}
		}
	}

	return [...affectedLabels];
};

export const tryAcquireRouteTelemetryLock = async (
	store: RouteTelemetryStore,
): Promise<boolean> => {
	if (advisoryLockSessions.has(store.repoId)) {
		return false;
	}
	const url = await resolveRouteTelemetryDatabaseUrl(store.config);
	if (!url) {
		return false;
	}
	const session = new Bun.SQL(url);
	const lockKey = buildRouteTelemetryLockKey(store.repoId);
	try {
		const rows = await session`
			SELECT pg_try_advisory_lock(${lockKey}) AS locked
		`;
		const row = rows[0] as Record<string, unknown> | undefined;
		const locked = Boolean(row?.locked);
		if (locked) {
			advisoryLockSessions.set(store.repoId, session);
			return true;
		}
		await session.close();
		return false;
	} catch (error) {
		await session.close();
		throw error;
	}
};

export const releaseRouteTelemetryLock = async (store: RouteTelemetryStore): Promise<void> => {
	const session = advisoryLockSessions.get(store.repoId);
	if (!session) {
		return;
	}
	const lockKey = buildRouteTelemetryLockKey(store.repoId);
	try {
		await session`
			SELECT pg_advisory_unlock(${lockKey})
		`;
	} finally {
		advisoryLockSessions.delete(store.repoId);
		await session.close();
	}
};

export const runRouteTelemetryMaintenance = async (options: {
	store: RouteTelemetryStore;
	lockOwner: string;
	scope?: RouteTelemetryScope;
	now?: Date;
}): Promise<{
	acquired: boolean;
	progress: RouteTelemetryMaintenanceProgress;
	affectedSourceLabels: RouteHintSourceLabel[];
	maintenanceState: RouteTelemetryMaintenanceState;
}> => {
	const scope = options.scope ?? { scope: "repo" as const };
	const now = options.now ?? new Date();
	const acquired = await tryAcquireRouteTelemetryLock(options.store);
	if (!acquired) {
		return {
			acquired: false,
			progress: emptyRouteTelemetryMaintenanceProgress(),
			affectedSourceLabels: [],
			maintenanceState: await options.store.loadMaintenanceState(),
		};
	}

	try {
		const current = await options.store.loadMaintenanceState();
		await options.store.saveMaintenanceState({
			...current,
			status: "running",
			lockOwner: options.lockOwner,
			lastStartedAt: now.toISOString(),
			lastError: null,
		});

		const events = (await options.store.listRouteExecutionEvents()).filter((event) =>
			isInScope(scope, event),
		);
		const last15m = aggregateEvents(options.store, events, "last15m");
		const last6h = aggregateRollups(options.store, last15m, "last6h");
		const existing6h = await options.store.listRollups({ tier: "last6h" });
		const last1d = aggregateRollups(
			options.store,
			[...existing6h.filter((rollup) => !isInScope(scope, rollup)), ...last6h].filter((rollup) =>
				isInScope(scope, rollup),
			),
			"last1d",
		);

		await deleteRollupsForScope(options.store, scope);
		await options.store.replaceRollups(
			"last15m",
			last15m.filter((rollup) => isInScope(scope, rollup)),
		);
		await options.store.replaceRollups(
			"last6h",
			last6h.filter((rollup) => isInScope(scope, rollup)),
		);
		await options.store.replaceRollups(
			"last1d",
			last1d.filter((rollup) => isInScope(scope, rollup)),
		);
		await pruneTelemetry(options.store, now);

		const refreshed15m = await options.store.listRollups({ tier: "last15m" });
		const refreshed6h = await options.store.listRollups({ tier: "last6h" });
		const refreshed1d = await options.store.listRollups({ tier: "last1d" });
		const affectedSourceLabels = await refreshSnapshots({
			store: options.store,
			scope,
			now,
			last15m: refreshed15m,
			last6h: refreshed6h,
			last1d: refreshed1d,
		});

		const progress = {
			closedBucketCount: last15m.length + last6h.length + last1d.length,
			remainingBucketCount: 0,
			lastProcessedBucketEnd: now.toISOString(),
		};
		const completedAt = now.toISOString();
		const nextState = {
			...current,
			status: "idle" as const,
			lockOwner: null,
			lastCompletedAt: completedAt,
			lastSuccessfulAt: completedAt,
			lastCompactedThrough: now.toISOString(),
			lastError: null,
			lagSeconds: 0,
		};
		await options.store.saveMaintenanceState(nextState);
		return {
			acquired: true,
			progress,
			affectedSourceLabels,
			maintenanceState: nextState,
		};
	} catch (error) {
		const current = await options.store.loadMaintenanceState();
		const failedState = {
			...current,
			status: "degraded" as const,
			lockOwner: null,
			lastCompletedAt: now.toISOString(),
			lastError: error instanceof Error ? error.message : String(error),
		};
		await options.store.saveMaintenanceState(failedState);
		throw error;
	} finally {
		await releaseRouteTelemetryLock(options.store);
	}
};
