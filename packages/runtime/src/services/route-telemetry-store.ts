import type { MimirmeshConfig } from "@mimirmesh/config";
import { buildRepoId } from "@mimirmesh/skills";
import {
	emptyRouteTelemetryMaintenanceState,
	type RouteTelemetryBucketTier,
	type RouteTelemetryScope,
	routeTelemetryRollupTable,
	stableJson,
} from "../state/route-telemetry";
import {
	ensureRouteTelemetrySchema,
	type RouteTelemetrySqlClient,
} from "../state/route-telemetry-migrations";
import type {
	RouteExecutionEvent,
	RouteHintSnapshot,
	RouteRollupBucket,
	RouteTelemetryMaintenanceState,
} from "../types";

const parseJsonColumn = <T>(value: unknown, fallback: T): T => {
	if (typeof value === "string") {
		try {
			return JSON.parse(value) as T;
		} catch {
			return fallback;
		}
	}
	if (value && typeof value === "object") {
		return value as T;
	}
	return fallback;
};

const asIsoString = (value: unknown): string | null => {
	if (value == null) {
		return null;
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	return typeof value === "string" ? value : new Date(value as number).toISOString();
};

const asNumber = (value: unknown): number => Number(value ?? 0);

const eventFromRow = (row: Record<string, unknown>): RouteExecutionEvent => ({
	eventId: String(row.event_id),
	repoId: String(row.repo_id),
	occurredAt: asIsoString(row.occurred_at) ?? new Date().toISOString(),
	sessionId: typeof row.session_id === "string" ? row.session_id : null,
	requestCorrelationId:
		typeof row.request_correlation_id === "string" ? row.request_correlation_id : null,
	unifiedTool: String(row.unified_tool),
	profileKey: String(row.profile_key),
	sanitizedArgumentSummary: parseJsonColumn(row.sanitized_argument_summary, {
		shapeVersion: 1,
		queryClass: "empty",
		hasPath: false,
		limitBand: "default",
		promptLengthBand: "short",
		identifierLike: false,
		additionalFlags: {},
	}),
	requestFingerprint: typeof row.request_fingerprint === "string" ? row.request_fingerprint : null,
	engine: row.engine as RouteExecutionEvent["engine"],
	engineTool: String(row.engine_tool),
	executionStrategy: row.execution_strategy as RouteExecutionEvent["executionStrategy"],
	staticPriority: asNumber(row.static_priority),
	attemptIndex: asNumber(row.attempt_index),
	outcome: row.outcome as RouteExecutionEvent["outcome"],
	failureClassification:
		typeof row.failure_classification === "string" ? row.failure_classification : null,
	latencyMs: asNumber(row.latency_ms),
	estimatedInputTokens: asNumber(row.estimated_input_tokens),
	estimatedOutputTokens: asNumber(row.estimated_output_tokens),
	inputBytes: asNumber(row.input_bytes),
	outputBytes: asNumber(row.output_bytes),
	resultItemCount: asNumber(row.result_item_count),
	hintSourceModeAtExecution:
		row.hint_source_mode_at_execution as RouteExecutionEvent["hintSourceModeAtExecution"],
	hintConfidenceAtExecution: asNumber(row.hint_confidence_at_execution),
	effectiveCostScoreAtExecution: asNumber(row.effective_cost_score_at_execution),
	orderingReasonCodes: parseJsonColumn(row.ordering_reason_codes, []),
	createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
});

const rollupFromRow = (row: Record<string, unknown>): RouteRollupBucket => ({
	repoId: String(row.repo_id),
	unifiedTool: String(row.unified_tool),
	profileKey: String(row.profile_key),
	engine: row.engine as RouteRollupBucket["engine"],
	engineTool: String(row.engine_tool),
	executionStrategy: row.execution_strategy as RouteRollupBucket["executionStrategy"],
	bucketStart: asIsoString(row.bucket_start) ?? new Date().toISOString(),
	attemptCount: asNumber(row.attempt_count),
	successCount: asNumber(row.success_count),
	degradedCount: asNumber(row.degraded_count),
	failedCount: asNumber(row.failed_count),
	avgLatencyMs: asNumber(row.avg_latency_ms),
	p95LatencyMs: asNumber(row.p95_latency_ms),
	avgEstimatedInputTokens: asNumber(row.avg_estimated_input_tokens),
	avgEstimatedOutputTokens: asNumber(row.avg_estimated_output_tokens),
	avgInputBytes: asNumber(row.avg_input_bytes),
	avgOutputBytes: asNumber(row.avg_output_bytes),
	avgResultItemCount: asNumber(row.avg_result_item_count),
	lastObservedAt: asIsoString(row.last_observed_at) ?? new Date().toISOString(),
	orderingReasonCounts: parseJsonColumn(row.ordering_reason_counts, {}),
});

const snapshotFromRow = (row: Record<string, unknown>): RouteHintSnapshot => ({
	repoId: String(row.repo_id),
	unifiedTool: String(row.unified_tool),
	profileKey: String(row.profile_key),
	engine: row.engine as RouteHintSnapshot["engine"],
	engineTool: String(row.engine_tool),
	executionStrategy: row.execution_strategy as RouteHintSnapshot["executionStrategy"],
	subsetEligible: Boolean(row.subset_eligible),
	sourceMode: row.source_mode as RouteHintSnapshot["sourceMode"],
	sourceLabel: row.source_label as RouteHintSnapshot["sourceLabel"],
	sampleCount: asNumber(row.sample_count),
	confidence: asNumber(row.confidence),
	freshnessState: row.freshness_state as RouteHintSnapshot["freshnessState"],
	freshnessAgeSeconds:
		row.freshness_age_seconds == null ? null : asNumber(row.freshness_age_seconds),
	estimatedInputTokens: asNumber(row.estimated_input_tokens),
	estimatedOutputTokens: asNumber(row.estimated_output_tokens),
	estimatedLatencyMs: asNumber(row.estimated_latency_ms),
	estimatedSuccessRate: asNumber(row.estimated_success_rate),
	degradedRate: asNumber(row.degraded_rate),
	cacheAffinity: row.cache_affinity as RouteHintSnapshot["cacheAffinity"],
	freshnessSensitivity: row.freshness_sensitivity as RouteHintSnapshot["freshnessSensitivity"],
	effectiveCostScore: asNumber(row.effective_cost_score),
	staticPriority: asNumber(row.static_priority),
	orderingReasonCodes: parseJsonColumn(row.ordering_reason_codes, []),
	lastObservedAt: asIsoString(row.last_observed_at),
	lastRefreshedAt: asIsoString(row.last_refreshed_at) ?? new Date().toISOString(),
	seedHash: String(row.seed_hash),
});

const maintenanceStateFromRow = (
	repoId: string,
	row?: Record<string, unknown>,
): RouteTelemetryMaintenanceState => {
	if (!row) {
		return emptyRouteTelemetryMaintenanceState(repoId);
	}

	return {
		repoId,
		lastStartedAt: asIsoString(row.last_started_at),
		lastCompletedAt: asIsoString(row.last_completed_at),
		lastSuccessfulAt: asIsoString(row.last_successful_at),
		lastCompactedThrough: asIsoString(row.last_compacted_through),
		status: row.status as RouteTelemetryMaintenanceState["status"],
		lagSeconds: asNumber(row.lag_seconds),
		lastError: typeof row.last_error === "string" ? row.last_error : null,
		lockOwner: typeof row.lock_owner === "string" ? row.lock_owner : null,
	};
};

export class RouteTelemetryStore {
	public readonly repoId: string;

	public constructor(
		public readonly projectRoot: string,
		public readonly config: MimirmeshConfig,
		private readonly sql: RouteTelemetrySqlClient,
	) {
		this.repoId = buildRepoId(projectRoot);
	}

	public async close(): Promise<void> {
		await this.sql.close();
	}

	public async recordRouteExecutionEvent(event: RouteExecutionEvent): Promise<void> {
		await this.sql`
			INSERT INTO route_execution_events (
				event_id,
				repo_id,
				occurred_at,
				session_id,
				request_correlation_id,
				unified_tool,
				profile_key,
				sanitized_argument_summary,
				request_fingerprint,
				engine,
				engine_tool,
				execution_strategy,
				static_priority,
				attempt_index,
				outcome,
				failure_classification,
				latency_ms,
				estimated_input_tokens,
				estimated_output_tokens,
				input_bytes,
				output_bytes,
				result_item_count,
				hint_source_mode_at_execution,
				hint_confidence_at_execution,
				effective_cost_score_at_execution,
				ordering_reason_codes,
				created_at
			) VALUES (
				${event.eventId},
				${event.repoId},
				${event.occurredAt},
				${event.sessionId},
				${event.requestCorrelationId},
				${event.unifiedTool},
				${event.profileKey},
				${stableJson(event.sanitizedArgumentSummary)}::jsonb,
				${event.requestFingerprint},
				${event.engine},
				${event.engineTool},
				${event.executionStrategy},
				${event.staticPriority},
				${event.attemptIndex},
				${event.outcome},
				${event.failureClassification},
				${event.latencyMs},
				${event.estimatedInputTokens},
				${event.estimatedOutputTokens},
				${event.inputBytes},
				${event.outputBytes},
				${event.resultItemCount},
				${event.hintSourceModeAtExecution},
				${event.hintConfidenceAtExecution},
				${event.effectiveCostScoreAtExecution},
				${stableJson(event.orderingReasonCodes)}::jsonb,
				${event.createdAt}
			)
		`;
	}

	public async listRouteExecutionEvents(
		options: {
			unifiedTool?: string;
			profileKey?: string;
			engine?: string;
			engineTool?: string;
			limit?: number;
		} = {},
	): Promise<RouteExecutionEvent[]> {
		const rows =
			options.profileKey && options.unifiedTool && options.limit
				? await this.sql`
					SELECT *
					FROM route_execution_events
					WHERE repo_id = ${this.repoId}
						AND unified_tool = ${options.unifiedTool}
						AND profile_key = ${options.profileKey}
					ORDER BY occurred_at DESC
					LIMIT ${options.limit}
				`
				: options.profileKey && options.unifiedTool
					? await this.sql`
						SELECT *
						FROM route_execution_events
						WHERE repo_id = ${this.repoId}
							AND unified_tool = ${options.unifiedTool}
							AND profile_key = ${options.profileKey}
						ORDER BY occurred_at DESC
					`
					: options.unifiedTool && options.limit
						? await this.sql`
						SELECT *
						FROM route_execution_events
						WHERE repo_id = ${this.repoId}
							AND unified_tool = ${options.unifiedTool}
						ORDER BY occurred_at DESC
						LIMIT ${options.limit}
					`
						: options.unifiedTool
							? await this.sql`
							SELECT *
							FROM route_execution_events
							WHERE repo_id = ${this.repoId}
								AND unified_tool = ${options.unifiedTool}
							ORDER BY occurred_at DESC
						`
							: options.limit
								? await this.sql`
						SELECT *
						FROM route_execution_events
						WHERE repo_id = ${this.repoId}
						ORDER BY occurred_at DESC
						LIMIT ${options.limit}
					`
								: await this.sql`
							SELECT *
							FROM route_execution_events
							WHERE repo_id = ${this.repoId}
							ORDER BY occurred_at DESC
						`;

		return (rows as Record<string, unknown>[])
			.map(eventFromRow)
			.filter((event) => !options.engine || event.engine === options.engine)
			.filter((event) => !options.engineTool || event.engineTool === options.engineTool);
	}

	public async listProfileKeys(unifiedTool: string): Promise<string[]> {
		const rows = await this.sql`
			SELECT DISTINCT profile_key
			FROM route_hint_snapshots
			WHERE repo_id = ${this.repoId}
				AND unified_tool = ${unifiedTool}
			ORDER BY profile_key ASC
		`;
		return (rows as Array<Record<string, unknown>>).map((row) => String(row.profile_key));
	}

	public async listRouteHintSnapshots(options: {
		unifiedTool: string;
		profileKey?: string;
		engine?: string;
		engineTool?: string;
	}): Promise<RouteHintSnapshot[]> {
		const rows = options.profileKey
			? await this.sql`
				SELECT *
				FROM route_hint_snapshots
				WHERE repo_id = ${this.repoId}
					AND unified_tool = ${options.unifiedTool}
					AND profile_key = ${options.profileKey}
				ORDER BY effective_cost_score ASC, static_priority DESC, engine ASC, engine_tool ASC
			`
			: await this.sql`
				SELECT *
				FROM route_hint_snapshots
				WHERE repo_id = ${this.repoId}
					AND unified_tool = ${options.unifiedTool}
				ORDER BY profile_key ASC, effective_cost_score ASC, static_priority DESC, engine ASC, engine_tool ASC
			`;

		return (rows as Record<string, unknown>[])
			.map(snapshotFromRow)
			.filter((snapshot) => !options.engine || snapshot.engine === options.engine)
			.filter((snapshot) => !options.engineTool || snapshot.engineTool === options.engineTool);
	}

	public async replaceRouteHintSnapshots(
		unifiedTool: string,
		profileKey: string,
		snapshots: RouteHintSnapshot[],
	): Promise<void> {
		await this.sql.begin(async (transaction) => {
			await transaction`
				DELETE FROM route_hint_snapshots
				WHERE repo_id = ${this.repoId}
					AND unified_tool = ${unifiedTool}
					AND profile_key = ${profileKey}
			`;

			for (const snapshot of snapshots) {
				await transaction`
					INSERT INTO route_hint_snapshots (
						repo_id,
						unified_tool,
						profile_key,
						engine,
						engine_tool,
						execution_strategy,
						subset_eligible,
						source_mode,
						source_label,
						sample_count,
						confidence,
						freshness_state,
						freshness_age_seconds,
						estimated_input_tokens,
						estimated_output_tokens,
						estimated_latency_ms,
						estimated_success_rate,
						degraded_rate,
						cache_affinity,
						freshness_sensitivity,
						effective_cost_score,
						static_priority,
						ordering_reason_codes,
						last_observed_at,
						last_refreshed_at,
						seed_hash
					) VALUES (
						${snapshot.repoId},
						${snapshot.unifiedTool},
						${snapshot.profileKey},
						${snapshot.engine},
						${snapshot.engineTool},
						${snapshot.executionStrategy},
						${snapshot.subsetEligible},
						${snapshot.sourceMode},
						${snapshot.sourceLabel},
						${snapshot.sampleCount},
						${snapshot.confidence},
						${snapshot.freshnessState},
						${snapshot.freshnessAgeSeconds},
						${snapshot.estimatedInputTokens},
						${snapshot.estimatedOutputTokens},
						${snapshot.estimatedLatencyMs},
						${snapshot.estimatedSuccessRate},
						${snapshot.degradedRate},
						${snapshot.cacheAffinity},
						${snapshot.freshnessSensitivity},
						${snapshot.effectiveCostScore},
						${snapshot.staticPriority},
						${stableJson(snapshot.orderingReasonCodes)}::jsonb,
						${snapshot.lastObservedAt},
						${snapshot.lastRefreshedAt},
						${snapshot.seedHash}
					)
				`;
			}
		});
	}

	public async listRollups(options: {
		tier: RouteTelemetryBucketTier;
		unifiedTool?: string;
		profileKey?: string;
		engine?: string;
		engineTool?: string;
		limit?: number;
	}): Promise<RouteRollupBucket[]> {
		const tableName = routeTelemetryRollupTable(options.tier);
		const rows =
			options.unifiedTool && options.profileKey && options.limit
				? await this.sql.unsafe(
						`SELECT * FROM ${tableName}
					 WHERE repo_id = $1
					   AND unified_tool = $2
					   AND profile_key = $3
					 ORDER BY bucket_start DESC
					 LIMIT $4`,
						[this.repoId, options.unifiedTool, options.profileKey, options.limit],
					)
				: options.unifiedTool && options.profileKey
					? await this.sql.unsafe(
							`SELECT * FROM ${tableName}
						 WHERE repo_id = $1
						   AND unified_tool = $2
						   AND profile_key = $3
						 ORDER BY bucket_start DESC`,
							[this.repoId, options.unifiedTool, options.profileKey],
						)
					: options.unifiedTool && options.limit
						? await this.sql.unsafe(
								`SELECT * FROM ${tableName}
						 WHERE repo_id = $1
						   AND unified_tool = $2
						 ORDER BY bucket_start DESC
						 LIMIT $3`,
								[this.repoId, options.unifiedTool, options.limit],
							)
						: options.unifiedTool
							? await this.sql.unsafe(
									`SELECT * FROM ${tableName}
							 WHERE repo_id = $1
							   AND unified_tool = $2
							 ORDER BY bucket_start DESC`,
									[this.repoId, options.unifiedTool],
								)
							: options.limit
								? await this.sql.unsafe(
										`SELECT * FROM ${tableName}
						 WHERE repo_id = $1
						 ORDER BY bucket_start DESC
						 LIMIT $2`,
										[this.repoId, options.limit],
									)
								: await this.sql.unsafe(
										`SELECT * FROM ${tableName}
							 WHERE repo_id = $1
							 ORDER BY bucket_start DESC`,
										[this.repoId],
									);

		return (rows as Record<string, unknown>[])
			.map(rollupFromRow)
			.filter((rollup) => !options.engine || rollup.engine === options.engine)
			.filter((rollup) => !options.engineTool || rollup.engineTool === options.engineTool);
	}

	public async replaceRollups(
		tier: RouteTelemetryBucketTier,
		rollups: RouteRollupBucket[],
	): Promise<void> {
		const tableName = routeTelemetryRollupTable(tier);
		await this.sql.begin(async (transaction) => {
			for (const rollup of rollups) {
				await transaction.unsafe(
					`INSERT INTO ${tableName} (
						repo_id,
						unified_tool,
						profile_key,
						engine,
						engine_tool,
						execution_strategy,
						bucket_start,
						attempt_count,
						success_count,
						degraded_count,
						failed_count,
						avg_latency_ms,
						p95_latency_ms,
						avg_estimated_input_tokens,
						avg_estimated_output_tokens,
						avg_input_bytes,
						avg_output_bytes,
						avg_result_item_count,
						last_observed_at,
						ordering_reason_counts
					) VALUES (
						$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
						$11, $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb
					)
					ON CONFLICT (repo_id, unified_tool, profile_key, engine, engine_tool, bucket_start)
					DO UPDATE SET
						execution_strategy = EXCLUDED.execution_strategy,
						attempt_count = EXCLUDED.attempt_count,
						success_count = EXCLUDED.success_count,
						degraded_count = EXCLUDED.degraded_count,
						failed_count = EXCLUDED.failed_count,
						avg_latency_ms = EXCLUDED.avg_latency_ms,
						p95_latency_ms = EXCLUDED.p95_latency_ms,
						avg_estimated_input_tokens = EXCLUDED.avg_estimated_input_tokens,
						avg_estimated_output_tokens = EXCLUDED.avg_estimated_output_tokens,
						avg_input_bytes = EXCLUDED.avg_input_bytes,
						avg_output_bytes = EXCLUDED.avg_output_bytes,
						avg_result_item_count = EXCLUDED.avg_result_item_count,
						last_observed_at = EXCLUDED.last_observed_at,
						ordering_reason_counts = EXCLUDED.ordering_reason_counts`,
					[
						rollup.repoId,
						rollup.unifiedTool,
						rollup.profileKey,
						rollup.engine,
						rollup.engineTool,
						rollup.executionStrategy,
						rollup.bucketStart,
						rollup.attemptCount,
						rollup.successCount,
						rollup.degradedCount,
						rollup.failedCount,
						rollup.avgLatencyMs,
						rollup.p95LatencyMs,
						rollup.avgEstimatedInputTokens,
						rollup.avgEstimatedOutputTokens,
						rollup.avgInputBytes,
						rollup.avgOutputBytes,
						rollup.avgResultItemCount,
						rollup.lastObservedAt,
						stableJson(rollup.orderingReasonCounts),
					],
				);
			}
		});
	}

	public async loadMaintenanceState(): Promise<RouteTelemetryMaintenanceState> {
		const rows = await this.sql`
			SELECT *
			FROM route_telemetry_maintenance
			WHERE repo_id = ${this.repoId}
			LIMIT 1
		`;
		return maintenanceStateFromRow(this.repoId, rows[0] as Record<string, unknown> | undefined);
	}

	public async saveMaintenanceState(state: RouteTelemetryMaintenanceState): Promise<void> {
		await this.sql`
			INSERT INTO route_telemetry_maintenance (
				repo_id,
				last_started_at,
				last_completed_at,
				last_successful_at,
				last_compacted_through,
				status,
				lag_seconds,
				last_error,
				lock_owner
			) VALUES (
				${state.repoId},
				${state.lastStartedAt},
				${state.lastCompletedAt},
				${state.lastSuccessfulAt},
				${state.lastCompactedThrough},
				${state.status},
				${state.lagSeconds},
				${state.lastError},
				${state.lockOwner}
			)
			ON CONFLICT (repo_id)
			DO UPDATE SET
				last_started_at = EXCLUDED.last_started_at,
				last_completed_at = EXCLUDED.last_completed_at,
				last_successful_at = EXCLUDED.last_successful_at,
				last_compacted_through = EXCLUDED.last_compacted_through,
				status = EXCLUDED.status,
				lag_seconds = EXCLUDED.lag_seconds,
				last_error = EXCLUDED.last_error,
				lock_owner = EXCLUDED.lock_owner
		`;
	}

	public async clearScope(scope: RouteTelemetryScope): Promise<void> {
		await this.sql.begin(async (transaction) => {
			if (scope.scope === "repo") {
				await transaction`
					DELETE FROM route_execution_events
					WHERE repo_id = ${this.repoId}
				`;
				await transaction`
					DELETE FROM route_hint_snapshots
					WHERE repo_id = ${this.repoId}
				`;
				await transaction`
					DELETE FROM route_telemetry_maintenance
					WHERE repo_id = ${this.repoId}
				`;
				for (const tier of ["last15m", "last6h", "last1d"] as const) {
					await transaction.unsafe(
						`DELETE FROM ${routeTelemetryRollupTable(tier)} WHERE repo_id = $1`,
						[this.repoId],
					);
				}
				return;
			}

			if (scope.scope === "route") {
				await transaction`
					DELETE FROM route_execution_events
					WHERE repo_id = ${this.repoId}
						AND unified_tool = ${scope.unifiedTool}
						AND engine = ${scope.engine}
						AND engine_tool = ${scope.engineTool}
				`;
				await transaction`
					DELETE FROM route_hint_snapshots
					WHERE repo_id = ${this.repoId}
						AND unified_tool = ${scope.unifiedTool}
						AND engine = ${scope.engine}
						AND engine_tool = ${scope.engineTool}
				`;
				for (const tier of ["last15m", "last6h", "last1d"] as const) {
					await transaction.unsafe(
						`DELETE FROM ${routeTelemetryRollupTable(tier)}
						 WHERE repo_id = $1
						   AND unified_tool = $2
						   AND engine = $3
						   AND engine_tool = $4`,
						[this.repoId, scope.unifiedTool, scope.engine, scope.engineTool],
					);
				}
				return;
			}

			await transaction`
				DELETE FROM route_execution_events
				WHERE repo_id = ${this.repoId}
					AND unified_tool = ${scope.unifiedTool}
			`;
			await transaction`
				DELETE FROM route_hint_snapshots
				WHERE repo_id = ${this.repoId}
					AND unified_tool = ${scope.unifiedTool}
			`;
			for (const tier of ["last15m", "last6h", "last1d"] as const) {
				await transaction.unsafe(
					`DELETE FROM ${routeTelemetryRollupTable(tier)}
					 WHERE repo_id = $1
					   AND unified_tool = $2`,
					[this.repoId, scope.unifiedTool],
				);
			}
		});
	}
}

export const openRouteTelemetryStore = async (
	projectRoot: string,
	config: MimirmeshConfig,
): Promise<RouteTelemetryStore | null> => {
	const schema = await ensureRouteTelemetrySchema(config);
	if (!schema.sql) {
		return null;
	}
	return new RouteTelemetryStore(projectRoot, config, schema.sql);
};
