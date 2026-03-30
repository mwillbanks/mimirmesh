import type { MimirmeshConfig } from "@mimirmesh/config";
import { composePort } from "../services/compose";

const postgresServiceName = "mm-postgres";
const postgresContainerPort = 5432;
const postgresUsername = "mimirmesh";
const postgresPassword = "mimirmesh";
const postgresDatabase = "mimirmesh";

const createSqlClient = (url: string) => new Bun.SQL(url);

export type RouteTelemetrySqlClient = ReturnType<typeof createSqlClient>;

const routeTelemetryMigrations = [
	{
		version: "011_route_telemetry_v1",
		sql: `
CREATE TABLE IF NOT EXISTS route_telemetry_migrations (
	version text PRIMARY KEY,
	applied_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS route_execution_events (
	event_id text PRIMARY KEY,
	repo_id text NOT NULL,
	occurred_at timestamptz NOT NULL,
	session_id text,
	request_correlation_id text,
	unified_tool text NOT NULL,
	profile_key text NOT NULL,
	sanitized_argument_summary jsonb NOT NULL,
	request_fingerprint text,
	engine text NOT NULL,
	engine_tool text NOT NULL,
	execution_strategy text NOT NULL,
	static_priority integer NOT NULL,
	attempt_index integer NOT NULL,
	outcome text NOT NULL,
	failure_classification text,
	latency_ms integer NOT NULL,
	estimated_input_tokens integer NOT NULL,
	estimated_output_tokens integer NOT NULL,
	input_bytes integer NOT NULL,
	output_bytes integer NOT NULL,
	result_item_count integer NOT NULL,
	hint_source_mode_at_execution text NOT NULL,
	hint_confidence_at_execution numeric NOT NULL,
	effective_cost_score_at_execution numeric NOT NULL,
	ordering_reason_codes jsonb NOT NULL,
	created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS route_execution_events_repo_tool_profile_idx
	ON route_execution_events (repo_id, unified_tool, profile_key, occurred_at DESC);

CREATE INDEX IF NOT EXISTS route_execution_events_repo_route_idx
	ON route_execution_events (repo_id, engine, engine_tool, occurred_at DESC);

CREATE TABLE IF NOT EXISTS route_rollup_15m (
	repo_id text NOT NULL,
	unified_tool text NOT NULL,
	profile_key text NOT NULL,
	engine text NOT NULL,
	engine_tool text NOT NULL,
	execution_strategy text NOT NULL,
	bucket_start timestamptz NOT NULL,
	attempt_count integer NOT NULL,
	success_count integer NOT NULL,
	degraded_count integer NOT NULL,
	failed_count integer NOT NULL,
	avg_latency_ms numeric NOT NULL,
	p95_latency_ms numeric NOT NULL,
	avg_estimated_input_tokens numeric NOT NULL,
	avg_estimated_output_tokens numeric NOT NULL,
	avg_input_bytes numeric NOT NULL,
	avg_output_bytes numeric NOT NULL,
	avg_result_item_count numeric NOT NULL,
	last_observed_at timestamptz NOT NULL,
	ordering_reason_counts jsonb NOT NULL,
	PRIMARY KEY (repo_id, unified_tool, profile_key, engine, engine_tool, bucket_start)
);

CREATE TABLE IF NOT EXISTS route_rollup_6h (
	LIKE route_rollup_15m INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES
);

CREATE TABLE IF NOT EXISTS route_rollup_1d (
	LIKE route_rollup_15m INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES
);

CREATE TABLE IF NOT EXISTS route_hint_snapshots (
	repo_id text NOT NULL,
	unified_tool text NOT NULL,
	profile_key text NOT NULL,
	engine text NOT NULL,
	engine_tool text NOT NULL,
	execution_strategy text NOT NULL,
	subset_eligible boolean NOT NULL,
	source_mode text NOT NULL,
	source_label text NOT NULL,
	sample_count integer NOT NULL,
	confidence numeric NOT NULL,
	freshness_state text NOT NULL,
	freshness_age_seconds integer,
	estimated_input_tokens numeric NOT NULL,
	estimated_output_tokens numeric NOT NULL,
	estimated_latency_ms numeric NOT NULL,
	estimated_success_rate numeric NOT NULL,
	degraded_rate numeric NOT NULL,
	cache_affinity text NOT NULL,
	freshness_sensitivity text NOT NULL,
	effective_cost_score numeric NOT NULL,
	static_priority integer NOT NULL,
	ordering_reason_codes jsonb NOT NULL,
	last_observed_at timestamptz,
	last_refreshed_at timestamptz NOT NULL,
	seed_hash text NOT NULL,
	PRIMARY KEY (repo_id, unified_tool, profile_key, engine, engine_tool)
);

CREATE INDEX IF NOT EXISTS route_hint_snapshots_repo_tool_profile_idx
	ON route_hint_snapshots (repo_id, unified_tool, profile_key);

CREATE TABLE IF NOT EXISTS route_telemetry_maintenance (
	repo_id text PRIMARY KEY,
	last_started_at timestamptz,
	last_completed_at timestamptz,
	last_successful_at timestamptz,
	last_compacted_through timestamptz,
	status text NOT NULL,
	lag_seconds integer NOT NULL,
	last_error text,
	lock_owner text
);
`,
	},
] as const;

const buildDatabaseUrl = (port: number): string =>
	`postgres://${postgresUsername}:${postgresPassword}@127.0.0.1:${port}/${postgresDatabase}`;

export const resolveRouteTelemetryDatabaseUrl = async (
	config: MimirmeshConfig,
): Promise<string | null> => {
	const port = await composePort(config, postgresServiceName, postgresContainerPort);
	return port ? buildDatabaseUrl(port) : null;
};

export const openRouteTelemetryDatabase = async (
	config: MimirmeshConfig,
): Promise<{ sql: RouteTelemetrySqlClient; url: string } | null> => {
	const url = await resolveRouteTelemetryDatabaseUrl(config);
	if (!url) {
		return null;
	}

	const sql = createSqlClient(url);
	try {
		await sql`SELECT 1`;
		return { sql, url };
	} catch {
		await sql.close();
		return null;
	}
};

export const ensureRouteTelemetrySchema = async (
	config: MimirmeshConfig,
): Promise<
	| {
			sql: RouteTelemetrySqlClient;
			url: string;
			appliedVersions: string[];
	  }
	| {
			sql: null;
			url: null;
			reason: string;
	  }
> => {
	const database = await openRouteTelemetryDatabase(config);
	if (!database) {
		return {
			sql: null,
			url: null,
			reason: "Runtime PostgreSQL is unavailable. Start the runtime before using route telemetry.",
		};
	}

	const appliedVersions: string[] = [];
	try {
		await database.sql.unsafe(`
CREATE TABLE IF NOT EXISTS route_telemetry_migrations (
	version text PRIMARY KEY,
	applied_at timestamptz NOT NULL
);`);

		for (const migration of routeTelemetryMigrations) {
			const existing = await database.sql`
				SELECT version
				FROM route_telemetry_migrations
				WHERE version = ${migration.version}
				LIMIT 1
			`;
			if (existing.length > 0) {
				continue;
			}

			await database.sql.begin(async (transaction) => {
				await transaction.unsafe(migration.sql);
				await transaction`
					INSERT INTO route_telemetry_migrations (version, applied_at)
					VALUES (${migration.version}, NOW())
				`;
			});
			appliedVersions.push(migration.version);
		}

		return {
			sql: database.sql,
			url: database.url,
			appliedVersions,
		};
	} catch (error) {
		await database.sql.close();
		return {
			sql: null,
			url: null,
			reason: error instanceof Error ? error.message : String(error),
		};
	}
};
