import type { MimirmeshConfig } from "@mimirmesh/config";
import { composePort } from "../services/compose";
import { acquireSharedSqlClient, type SharedSqlClient } from "./shared-sql-client";

const postgresServiceName = "mm-postgres";
const postgresContainerPort = 5432;
const postgresUsername = "mimirmesh";
const postgresPassword = "mimirmesh";
const postgresDatabase = "mimirmesh";

export type SkillRegistrySqlClient = SharedSqlClient;

const ensuredSkillRegistrySchemas = new Set<string>();
const inFlightSkillRegistrySchemaEnsures = new Map<string, Promise<string[]>>();

const skillRegistryMigrations = [
	{
		version: "010_skill_registry_v1",
		sql: `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS skill_registry_migrations (
	version text PRIMARY KEY,
	applied_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_registry_state (
	repo_id text PRIMARY KEY,
	project_root text NOT NULL,
	config_hash text NOT NULL,
	provider_selection jsonb NOT NULL,
	bootstrap jsonb NOT NULL,
	readiness jsonb NOT NULL,
	last_indexed_at timestamptz,
	updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS skill_registry_state_project_root_idx
	ON skill_registry_state (project_root);

CREATE TABLE IF NOT EXISTS skill_records (
	repo_id text NOT NULL,
	skill_id text NOT NULL,
	name text NOT NULL,
	short_description text NOT NULL,
	description text NOT NULL,
	compatibility text,
	content_hash text NOT NULL,
	schema_version text NOT NULL,
	source jsonb NOT NULL,
	metadata jsonb NOT NULL,
	parse_warnings jsonb NOT NULL,
	search_text text NOT NULL,
	raw_markdown bytea NOT NULL,
	raw_compression jsonb NOT NULL,
	normalized_record bytea NOT NULL,
	normalized_compression jsonb NOT NULL,
	discovered_at timestamptz NOT NULL,
	indexed_at timestamptz NOT NULL,
	updated_at timestamptz NOT NULL,
	PRIMARY KEY (repo_id, skill_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS skill_records_repo_name_idx
	ON skill_records (repo_id, name);

CREATE INDEX IF NOT EXISTS skill_records_repo_content_hash_idx
	ON skill_records (repo_id, content_hash);

CREATE TABLE IF NOT EXISTS skill_positive_cache (
	repo_id text NOT NULL,
	lookup_key text NOT NULL,
	skill_name text NOT NULL,
	content_hash text NOT NULL,
	read_signature text NOT NULL,
	payload jsonb NOT NULL,
	created_at timestamptz NOT NULL,
	PRIMARY KEY (repo_id, skill_name, content_hash, read_signature)
);

CREATE INDEX IF NOT EXISTS skill_positive_cache_repo_lookup_idx
	ON skill_positive_cache (repo_id, lookup_key);

CREATE TABLE IF NOT EXISTS skill_negative_cache (
	repo_id text NOT NULL,
	lookup_key text NOT NULL,
	created_at timestamptz NOT NULL,
	expires_at timestamptz NOT NULL,
	PRIMARY KEY (repo_id, lookup_key)
);

CREATE INDEX IF NOT EXISTS skill_negative_cache_repo_expires_idx
	ON skill_negative_cache (repo_id, expires_at);

CREATE TABLE IF NOT EXISTS skill_embeddings (
	repo_id text NOT NULL,
	skill_id text NOT NULL,
	target_type text NOT NULL,
	target_key text NOT NULL,
	model text NOT NULL,
	dims integer NOT NULL,
	embedding_hash text NOT NULL,
	provider_type text NOT NULL,
	vector vector NOT NULL,
	created_at timestamptz NOT NULL,
	PRIMARY KEY (repo_id, skill_id, target_type, target_key, model, embedding_hash)
);

CREATE INDEX IF NOT EXISTS skill_embeddings_repo_model_idx
	ON skill_embeddings (repo_id, model);
`,
	},
] as const;

const buildDatabaseUrl = (port: number): string =>
	`postgres://${postgresUsername}:${postgresPassword}@127.0.0.1:${port}/${postgresDatabase}`;

export const resolveSkillRegistryDatabaseUrl = async (
	config: MimirmeshConfig,
): Promise<string | null> => {
	const port = await composePort(config, postgresServiceName, postgresContainerPort);
	return port ? buildDatabaseUrl(port) : null;
};

export const openSkillRegistryDatabase = async (
	config: MimirmeshConfig,
): Promise<{ sql: SkillRegistrySqlClient; url: string; clientId: string } | null> => {
	const url = await resolveSkillRegistryDatabaseUrl(config);
	if (!url) {
		return null;
	}

	try {
		return await acquireSharedSqlClient({
			url,
			cacheKey: `runtime-postgres:${url}`,
		});
	} catch {
		return null;
	}
};

const ensureSkillRegistrySchemaInitialized = async (
	clientId: string,
	sql: SkillRegistrySqlClient,
): Promise<string[]> => {
	if (ensuredSkillRegistrySchemas.has(clientId)) {
		return [];
	}

	const pending = inFlightSkillRegistrySchemaEnsures.get(clientId);
	if (pending) {
		return pending;
	}

	const initialization = (async () => {
		const appliedVersions: string[] = [];
		await sql.unsafe(`
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS skill_registry_migrations (
	version text PRIMARY KEY,
	applied_at timestamptz NOT NULL
);`);

		for (const migration of skillRegistryMigrations) {
			const existing = await sql`
				SELECT version
				FROM skill_registry_migrations
				WHERE version = ${migration.version}
				LIMIT 1
			`;
			if (existing.length > 0) {
				continue;
			}

			await sql.begin(async (transaction) => {
				await transaction.unsafe(migration.sql);
				await transaction`
					INSERT INTO skill_registry_migrations (version, applied_at)
					VALUES (${migration.version}, NOW())
				`;
			});
			appliedVersions.push(migration.version);
		}

		ensuredSkillRegistrySchemas.add(clientId);
		return appliedVersions;
	})().finally(() => {
		if (inFlightSkillRegistrySchemaEnsures.get(clientId) === initialization) {
			inFlightSkillRegistrySchemaEnsures.delete(clientId);
		}
	});

	inFlightSkillRegistrySchemaEnsures.set(clientId, initialization);
	return initialization;
};

export const ensureSkillRegistrySchema = async (
	config: MimirmeshConfig,
): Promise<
	| {
			sql: SkillRegistrySqlClient;
			url: string;
			clientId: string;
			appliedVersions: string[];
	  }
	| {
			sql: null;
			url: null;
			reason: string;
	  }
> => {
	const database = await openSkillRegistryDatabase(config);
	if (!database) {
		return {
			sql: null,
			url: null,
			reason:
				"Runtime PostgreSQL is unavailable. Start the runtime and run `skills.refresh` to rebuild the repository skill index.",
		};
	}

	try {
		const appliedVersions = await ensureSkillRegistrySchemaInitialized(
			database.clientId,
			database.sql,
		);

		return {
			sql: database.sql,
			url: database.url,
			clientId: database.clientId,
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
