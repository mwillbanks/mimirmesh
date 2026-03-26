import type { MimirmeshConfig } from "@mimirmesh/config";
import {
	buildReadSignature,
	buildRepoId,
	buildSkillEmbeddingText,
	compressText,
	createRefreshResponse,
	createTextEmbedding,
	createTextEmbeddings,
	decompressText,
	deriveShortDescription,
	hashDeterministic,
	loadSkillRecords,
	readSkillFromRecord,
	type SkillEmbeddingProvider,
	type SkillReadRequest,
	type SkillRecord,
	type SkillsRefreshRequest,
	type SkillsRefreshResponse,
	stableStringify,
} from "@mimirmesh/skills";

import { ensureSkillRegistryState } from "../bootstrap/skills";
import { hashValue } from "../state/io";
import { skillRegistryStatePath } from "../state/paths";
import {
	persistSkillRegistryState,
	type SkillEmbeddingEntry,
	type SkillProviderSelection,
	type SkillRegistryCacheEntry,
	type SkillRegistryNegativeCacheEntry,
	type SkillRegistryState,
} from "../state/skills";
import { ensureSkillRegistrySchema, type SkillRegistrySqlClient } from "../state/skills-migrations";
import { composePort } from "./compose";

const defaultReadRequest = (name: string): SkillReadRequest => ({
	name,
	mode: "memory",
});

const uniqueNames = (names?: string[]): string[] => [
	...new Set((names ?? []).map((name) => name.trim()).filter(Boolean)),
];

const vectorLiteral = (vector: number[]): string =>
	`[${vector.map((value) => Number(value).toString()).join(",")}]`;

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

const asIsoString = (value: unknown): string => {
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (typeof value === "string") {
		return value;
	}
	return new Date().toISOString();
};

const positiveCacheEntryFromRow = (row: Record<string, unknown>): SkillRegistryCacheEntry => ({
	repoId: String(row.repo_id),
	lookupKey: String(row.lookup_key),
	skillName: String(row.skill_name),
	contentHash: String(row.content_hash),
	readSignature: String(row.read_signature),
	payload: parseJsonColumn(row.payload, {}),
	createdAt: asIsoString(row.created_at),
});

const negativeCacheEntryFromRow = (
	row: Record<string, unknown>,
): SkillRegistryNegativeCacheEntry => ({
	repoId: String(row.repo_id),
	lookupKey: String(row.lookup_key),
	createdAt: asIsoString(row.created_at),
	expiresAt: asIsoString(row.expires_at),
});

const embeddingEntryFromRow = (row: Record<string, unknown>): SkillEmbeddingEntry => ({
	skillId: String(row.skill_id),
	targetType: row.target_type as SkillEmbeddingEntry["targetType"],
	model: String(row.model),
	dims: Number(row.dims),
	embeddingHash: String(row.embedding_hash),
	providerType: row.provider_type as SkillEmbeddingEntry["providerType"],
	createdAt: asIsoString(row.created_at),
});

const pruneExpiredNegativeCache = (
	entries: SkillRegistryNegativeCacheEntry[],
	nowIso: string,
): SkillRegistryNegativeCacheEntry[] => entries.filter((entry) => entry.expiresAt > nowIso);

const serializeRecordForStorage = (
	record: SkillRecord,
	config: MimirmeshConfig,
): {
	record: SkillRecord;
	searchText: string;
	rawMarkdown: Uint8Array;
	rawCompression: SkillRecord["rawCompression"];
	normalizedRecord: Uint8Array;
	normalizedCompression: SkillRecord["normalizedCompression"];
} => {
	const requestedAlgorithm = config.skills.compression.algorithm;
	const rawCompressed = compressText(record.rawMarkdown, requestedAlgorithm);
	const normalizedCompressed = compressText(stableStringify(record), requestedAlgorithm);

	return {
		record: {
			...record,
			rawCompression: {
				algorithm: rawCompressed.algorithm,
				scope: "at-rest",
				sizeBytes: rawCompressed.sizeBytes,
			},
			normalizedCompression: {
				algorithm: normalizedCompressed.algorithm,
				scope: "at-rest",
				sizeBytes: normalizedCompressed.sizeBytes,
			},
		},
		searchText: [
			record.name,
			record.description,
			record.bodyMarkdown,
			...record.sections.map((section) => section.text),
			...record.assets.map((asset) => asset.path),
		]
			.filter(Boolean)
			.join("\n"),
		rawMarkdown: Buffer.from(rawCompressed.data, "base64"),
		rawCompression: {
			algorithm: rawCompressed.algorithm,
			scope: "at-rest",
			sizeBytes: rawCompressed.sizeBytes,
		},
		normalizedRecord: Buffer.from(normalizedCompressed.data, "base64"),
		normalizedCompression: {
			algorithm: normalizedCompressed.algorithm,
			scope: "at-rest",
			sizeBytes: normalizedCompressed.sizeBytes,
		},
	};
};

const recordFromRow = (row: Record<string, unknown>): SkillRecord => {
	const normalizedCompression = parseJsonColumn<NonNullable<
		SkillRecord["normalizedCompression"]
	> | null>(row.normalized_compression, null);
	const rawCompression = parseJsonColumn<NonNullable<SkillRecord["rawCompression"]> | null>(
		row.raw_compression,
		null,
	);
	const normalizedRecordBase64 = String(row.normalized_record_base64);
	const normalizedRecord = JSON.parse(
		decompressText({
			algorithm: normalizedCompression?.algorithm ?? "none",
			data: normalizedRecordBase64,
		}),
	) as SkillRecord;

	return {
		...normalizedRecord,
		rawCompression,
		normalizedCompression,
	};
};

const buildDefaultPositiveCacheEntries = (
	repoId: string,
	records: SkillRecord[],
): SkillRegistryCacheEntry[] =>
	records.map((record) => {
		const request = defaultReadRequest(record.name);
		return {
			repoId,
			lookupKey: record.name,
			skillName: record.name,
			contentHash: record.contentHash,
			readSignature: buildReadSignature(request),
			payload: readSkillFromRecord(record, request),
			createdAt: new Date().toISOString(),
		};
	});

const createMirroredState = (
	state: SkillRegistryState,
	overrides: Partial<SkillRegistryState> = {},
): SkillRegistryState => ({
	...state,
	...overrides,
	skills: overrides.skills ?? [],
	positiveCache: overrides.positiveCache ?? [],
	negativeCache: overrides.negativeCache ?? [],
	embeddings: overrides.embeddings ?? [],
});

const persistMirroredState = async (
	projectRoot: string,
	state: SkillRegistryState,
): Promise<SkillRegistryState> => {
	const mirrored = createMirroredState(state);
	await persistSkillRegistryState(projectRoot, mirrored);
	return mirrored;
};

const loadPersistedStateRow = async (
	sql: SkillRegistrySqlClient,
	repoId: string,
): Promise<{
	configHash: string;
	providerSelection: SkillProviderSelection;
	bootstrap: SkillRegistryState["bootstrap"];
	readiness: SkillRegistryState["readiness"];
	lastIndexedAt: string | null;
	updatedAt: string;
} | null> => {
	const rows = await sql`
		SELECT repo_id, config_hash, provider_selection, bootstrap, readiness, last_indexed_at, updated_at
		FROM skill_registry_state
		WHERE repo_id = ${repoId}
		LIMIT 1
	`;
	const row = rows[0] as Record<string, unknown> | undefined;
	if (!row) {
		return null;
	}

	return {
		configHash: String(row.config_hash),
		providerSelection: parseJsonColumn(row.provider_selection, {
			enabled: false,
			readiness: "ready",
			reasons: [],
			providers: [],
			selectedProviderIndex: null,
			selectedProviderType: null,
			localRuntime: null,
		}),
		bootstrap: parseJsonColumn(row.bootstrap, {
			state: "bootstrapping",
			checkedAt: new Date().toISOString(),
			hostGpuAvailable: false,
			reasons: [],
		}),
		readiness: parseJsonColumn(row.readiness, {
			state: "bootstrapping",
			checkedAt: new Date().toISOString(),
			statePath: skillRegistryStatePath(""),
			configHash: String(row.config_hash),
			embeddingsEnabled: false,
			providerCount: 0,
			reasons: [],
		}),
		lastIndexedAt: row.last_indexed_at ? asIsoString(row.last_indexed_at) : null,
		updatedAt: asIsoString(row.updated_at),
	};
};

const loadPersistedRecords = async (
	sql: SkillRegistrySqlClient,
	repoId: string,
): Promise<SkillRecord[]> => {
	const rows = await sql`
		SELECT
			repo_id,
			skill_id,
			name,
			content_hash,
			raw_compression,
			normalized_compression,
			encode(normalized_record, 'base64') AS normalized_record_base64
		FROM skill_records
		WHERE repo_id = ${repoId}
		ORDER BY name ASC
	`;
	return rows.map((row: unknown) => recordFromRow(row as Record<string, unknown>));
};

const loadPersistedPositiveCache = async (
	sql: SkillRegistrySqlClient,
	repoId: string,
): Promise<SkillRegistryCacheEntry[]> => {
	const rows = await sql`
		SELECT repo_id, lookup_key, skill_name, content_hash, read_signature, payload, created_at
		FROM skill_positive_cache
		WHERE repo_id = ${repoId}
		ORDER BY skill_name ASC, read_signature ASC
	`;
	return rows.map((row: unknown) => positiveCacheEntryFromRow(row as Record<string, unknown>));
};

const loadPersistedNegativeCache = async (
	sql: SkillRegistrySqlClient,
	repoId: string,
): Promise<SkillRegistryNegativeCacheEntry[]> => {
	const rows = await sql`
		SELECT repo_id, lookup_key, created_at, expires_at
		FROM skill_negative_cache
		WHERE repo_id = ${repoId}
		ORDER BY lookup_key ASC
	`;
	return rows.map((row: unknown) => negativeCacheEntryFromRow(row as Record<string, unknown>));
};

const loadPersistedEmbeddings = async (
	sql: SkillRegistrySqlClient,
	repoId: string,
): Promise<SkillEmbeddingEntry[]> => {
	const rows = await sql`
		SELECT skill_id, target_type, model, dims, embedding_hash, provider_type, created_at
		FROM skill_embeddings
		WHERE repo_id = ${repoId}
		ORDER BY skill_id ASC, target_type ASC
	`;
	return rows.map((row: unknown) => embeddingEntryFromRow(row as Record<string, unknown>));
};

const resolveRuntimeEmbeddingProviders = async (
	_projectRoot: string,
	config: MimirmeshConfig,
	state: SkillRegistryState,
): Promise<{ providers: SkillEmbeddingProvider[]; diagnostics: string[] }> => {
	if (!config.skills.embeddings.enabled) {
		return { providers: [], diagnostics: [] };
	}

	const diagnostics: string[] = [];
	const providers: SkillEmbeddingProvider[] = [];
	for (const provider of config.skills.embeddings.providers) {
		if (provider.type !== "llama_cpp") {
			providers.push({ ...provider });
			continue;
		}

		const localRuntime = state.providerSelection.localRuntime;
		if (!localRuntime) {
			diagnostics.push(
				"Local llama.cpp embeddings are configured but no local runtime is selected.",
			);
			continue;
		}

		const port = await composePort(config, localRuntime.serviceName, localRuntime.port);
		if (!port) {
			diagnostics.push(
				`Local llama.cpp embeddings are configured but ${localRuntime.serviceName} is not reachable on the host.`,
			);
			continue;
		}

		providers.push({
			...provider,
			baseUrl: `http://127.0.0.1:${port}/v1`,
		});
	}

	return {
		providers,
		diagnostics,
	};
};

const loadCurrentState = async (
	projectRoot: string,
	config: MimirmeshConfig,
): Promise<
	| {
			state: SkillRegistryState;
			sql: SkillRegistrySqlClient;
	  }
	| {
			state: SkillRegistryState;
			sql: null;
			reason: string;
	  }
> => {
	const initialState = await ensureSkillRegistryState(projectRoot, config);
	const schema = await ensureSkillRegistrySchema(config);
	if (!schema.sql) {
		const degradedState = createMirroredState(initialState, {
			updatedAt: new Date().toISOString(),
			readiness: {
				...initialState.readiness,
				state: "degraded",
				checkedAt: new Date().toISOString(),
				reasons: [schema.reason],
			},
		});
		await persistMirroredState(projectRoot, degradedState);
		return {
			state: degradedState,
			sql: null,
			reason: schema.reason,
		};
	}

	const repoId = buildRepoId(projectRoot);
	const [stateRow, skills, positiveCache, negativeCache, embeddings] = await Promise.all([
		loadPersistedStateRow(schema.sql, repoId),
		loadPersistedRecords(schema.sql, repoId),
		loadPersistedPositiveCache(schema.sql, repoId),
		loadPersistedNegativeCache(schema.sql, repoId),
		loadPersistedEmbeddings(schema.sql, repoId),
	]);

	const nowIso = new Date().toISOString();
	const nextState = createMirroredState(initialState, {
		updatedAt: stateRow?.updatedAt ?? initialState.updatedAt,
		configHash: stateRow?.configHash ?? initialState.configHash,
		providerSelection: stateRow?.providerSelection ?? initialState.providerSelection,
		bootstrap: stateRow?.bootstrap ?? initialState.bootstrap,
		readiness: stateRow?.readiness ?? {
			...initialState.readiness,
			state: initialState.lastIndexedAt ? "ready" : "bootstrapping",
			checkedAt: nowIso,
			reasons:
				skills.length > 0 ? [] : ["Skill registry has not been refreshed for this repository yet."],
		},
		lastIndexedAt: stateRow?.lastIndexedAt ?? initialState.lastIndexedAt,
		skills,
		positiveCache,
		negativeCache: pruneExpiredNegativeCache(negativeCache, nowIso),
		embeddings,
	});
	await persistMirroredState(projectRoot, nextState);
	return {
		state: nextState,
		sql: schema.sql,
	};
};

const refreshResponseForState = (options: {
	projectRoot: string;
	scope: "repo" | "all";
	refreshed: SkillRecord[];
	invalidatedPositiveCacheEntries: number;
	invalidatedNegativeCacheEntries: number;
	embeddingsReindexed: number;
	diagnostics: string[];
	state: SkillRegistryState;
}): SkillsRefreshResponse => {
	const response = createRefreshResponse({
		refreshed: options.refreshed,
		scope: options.scope,
		invalidatedPositiveCacheEntries: options.invalidatedPositiveCacheEntries,
		invalidatedNegativeCacheEntries: options.invalidatedNegativeCacheEntries,
		embeddingsReindexed: options.embeddingsReindexed,
	});
	return {
		...response,
		runtimeReadiness: {
			ready: options.state.readiness.state === "ready",
			healthClassification:
				options.state.readiness.state === "ready"
					? "healthy"
					: options.state.readiness.state === "degraded"
						? "degraded"
						: "unavailable",
			stateArtifactPaths: [skillRegistryStatePath(options.projectRoot)],
			message:
				options.state.readiness.reasons[0] ??
				`Indexed ${options.refreshed.length} skill(s) for ${options.projectRoot}.`,
		},
		diagnostics: options.diagnostics,
	};
};

const persistStateRow = async (
	sql: SkillRegistrySqlClient,
	state: SkillRegistryState,
): Promise<void> => {
	await sql`
		INSERT INTO skill_registry_state (
			repo_id,
			project_root,
			config_hash,
			provider_selection,
			bootstrap,
			readiness,
			last_indexed_at,
			updated_at
		)
		VALUES (
			${buildRepoId(state.projectRoot)},
			${state.projectRoot},
			${state.configHash},
			${JSON.stringify(state.providerSelection)}::jsonb,
			${JSON.stringify(state.bootstrap)}::jsonb,
			${JSON.stringify(state.readiness)}::jsonb,
			${state.lastIndexedAt},
			${state.updatedAt}
		)
		ON CONFLICT (repo_id) DO UPDATE SET
			project_root = EXCLUDED.project_root,
			config_hash = EXCLUDED.config_hash,
			provider_selection = EXCLUDED.provider_selection,
			bootstrap = EXCLUDED.bootstrap,
			readiness = EXCLUDED.readiness,
			last_indexed_at = EXCLUDED.last_indexed_at,
			updated_at = EXCLUDED.updated_at
	`;
};

export const loadSkillRegistrySnapshot = async (
	projectRoot: string,
	config: MimirmeshConfig,
): Promise<SkillRegistryState> => {
	const current = await loadCurrentState(projectRoot, config);
	if (current.sql) {
		await current.sql.close();
	}
	return current.state;
};

export const resolveSkillRegistryEmbeddingMatches = async (
	projectRoot: string,
	config: MimirmeshConfig,
	request: { prompt: string; limit?: number },
): Promise<{
	matches: Array<{ name: string; score: number; reason: string }>;
	diagnostics: string[];
}> => {
	const current = await loadCurrentState(projectRoot, config);
	if (!current.sql) {
		return {
			matches: [],
			diagnostics: current.reason ? [current.reason] : [],
		};
	}

	try {
		const providerResolution = await resolveRuntimeEmbeddingProviders(
			projectRoot,
			config,
			current.state,
		);
		if (providerResolution.providers.length === 0) {
			return {
				matches: [],
				diagnostics: providerResolution.diagnostics,
			};
		}

		const embedding = await createTextEmbedding({
			input: request.prompt,
			providers: providerResolution.providers,
			enabled: config.skills.embeddings.enabled,
			fallbackOnFailure: config.skills.embeddings.fallbackOnFailure,
		});
		if (!embedding) {
			return {
				matches: [],
				diagnostics: providerResolution.diagnostics,
			};
		}

		const limit = request.limit ?? 10;
		const rows = await current.sql`
			SELECT
				skill_records.name,
				1 - (skill_embeddings.vector <=> ${vectorLiteral(embedding.vector)}::vector) AS score
			FROM skill_embeddings
			JOIN skill_records
				ON skill_records.repo_id = skill_embeddings.repo_id
				AND skill_records.skill_id = skill_embeddings.skill_id
			WHERE skill_embeddings.repo_id = ${buildRepoId(projectRoot)}
				AND skill_embeddings.model = ${embedding.model}
				AND skill_embeddings.target_type = 'summary'
			ORDER BY skill_embeddings.vector <=> ${vectorLiteral(embedding.vector)}::vector
			LIMIT ${limit}
		`;

		return {
			matches: rows.map((row: unknown) => ({
				name: String((row as Record<string, unknown>).name),
				score: Number((row as Record<string, unknown>).score ?? 0),
				reason: "embeddings",
			})),
			diagnostics: [...providerResolution.diagnostics, ...embedding.diagnostics],
		};
	} finally {
		await current.sql.close();
	}
};

export const refreshSkillRegistryStore = async (
	projectRoot: string,
	config: MimirmeshConfig,
	request: SkillsRefreshRequest = {},
): Promise<{ state: SkillRegistryState; response: SkillsRefreshResponse }> => {
	const baseState = await ensureSkillRegistryState(projectRoot, config);
	const schema = await ensureSkillRegistrySchema(config);
	if (!schema.sql) {
		const degradedState = createMirroredState(baseState, {
			updatedAt: new Date().toISOString(),
			readiness: {
				...baseState.readiness,
				state: "degraded",
				checkedAt: new Date().toISOString(),
				reasons: [schema.reason],
			},
		});
		await persistMirroredState(projectRoot, degradedState);
		return {
			state: degradedState,
			response: refreshResponseForState({
				projectRoot,
				scope: request.scope === "all" ? "all" : "repo",
				refreshed: [],
				invalidatedPositiveCacheEntries: 0,
				invalidatedNegativeCacheEntries: 0,
				embeddingsReindexed: 0,
				diagnostics: [schema.reason],
				state: degradedState,
			}),
		};
	}

	const sql = schema.sql;
	const repoId = buildRepoId(projectRoot);
	const nowIso = new Date().toISOString();
	const requestedNames = uniqueNames(request.names);
	const targetedNames = requestedNames.length > 0 ? new Set(requestedNames) : null;
	const allCurrentRecords = await loadSkillRecords(projectRoot);
	const existingRecords = await loadPersistedRecords(sql, repoId);
	const existingByName = new Map(existingRecords.map((record) => [record.name, record]));
	const refreshableRecords = targetedNames
		? allCurrentRecords.filter((record) => targetedNames.has(record.name))
		: allCurrentRecords;
	const recordsToPersist = refreshableRecords.map((record) => {
		const existing = existingByName.get(record.name);
		return existing
			? {
					...record,
					id: existing.id,
					discoveredAt: existing.discoveredAt,
				}
			: record;
	});
	const removedNames = (targetedNames ? existingRecords : existingRecords).filter((record) =>
		targetedNames
			? targetedNames.has(record.name) &&
				!recordsToPersist.some((entry) => entry.name === record.name)
			: !recordsToPersist.some((entry) => entry.name === record.name),
	);
	const targetNames = new Set(recordsToPersist.map((record) => record.name));
	const cacheNames = new Set([
		...recordsToPersist.map((record) => record.name),
		...removedNames.map((record) => record.name),
	]);

	const currentNegativeCache = pruneExpiredNegativeCache(
		await loadPersistedNegativeCache(sql, repoId),
		nowIso,
	);
	const currentPositiveCache = await loadPersistedPositiveCache(sql, repoId);

	const invalidatedPositiveCacheEntries = currentPositiveCache.filter((entry) =>
		cacheNames.has(entry.skillName),
	).length;
	const invalidatedNegativeCacheEntries = currentNegativeCache.filter((entry) =>
		targetedNames ? targetedNames.has(entry.lookupKey) : true,
	).length;

	const providerResolution = await resolveRuntimeEmbeddingProviders(projectRoot, config, baseState);
	const dirtyEmbeddingRecords = recordsToPersist.filter((record) => {
		if (request.reindexEmbeddings) {
			return true;
		}
		const existing = existingByName.get(record.name);
		return !existing || existing.contentHash !== record.contentHash;
	});

	let embeddingsReindexed = 0;
	const diagnostics = [...providerResolution.diagnostics];

	try {
		await sql.begin(async (transaction) => {
			for (const name of cacheNames) {
				await transaction`
					DELETE FROM skill_positive_cache
					WHERE repo_id = ${repoId}
						AND skill_name = ${name}
				`;
			}

			if (targetedNames) {
				for (const name of requestedNames) {
					await transaction`
						DELETE FROM skill_negative_cache
						WHERE repo_id = ${repoId}
							AND lookup_key = ${name}
					`;
				}
			} else {
				await transaction`
					DELETE FROM skill_negative_cache
					WHERE repo_id = ${repoId}
				`;
			}

			for (const record of removedNames) {
				await transaction`
					DELETE FROM skill_embeddings
					WHERE repo_id = ${repoId}
						AND skill_id = ${record.id}
				`;
				await transaction`
					DELETE FROM skill_records
					WHERE repo_id = ${repoId}
						AND skill_id = ${record.id}
				`;
			}

			for (const record of recordsToPersist) {
				const stored = serializeRecordForStorage(record, config);
				await transaction`
					INSERT INTO skill_records (
						repo_id,
						skill_id,
						name,
						short_description,
						description,
						compatibility,
						content_hash,
						schema_version,
						source,
						metadata,
						parse_warnings,
						search_text,
						raw_markdown,
						raw_compression,
						normalized_record,
						normalized_compression,
						discovered_at,
						indexed_at,
						updated_at
					)
					VALUES (
						${repoId},
						${record.id},
						${record.name},
						${deriveShortDescription(record.description)},
						${record.description},
						${record.compatibility ?? null},
						${record.contentHash},
						${record.schemaVersion},
						${JSON.stringify(record.source)}::jsonb,
						${JSON.stringify(record.metadata)}::jsonb,
						${JSON.stringify(record.parseWarnings)}::jsonb,
						${stored.searchText},
						${stored.rawMarkdown},
						${JSON.stringify(stored.rawCompression)}::jsonb,
						${stored.normalizedRecord},
						${JSON.stringify(stored.normalizedCompression)}::jsonb,
						${record.discoveredAt},
						${nowIso},
						${nowIso}
					)
					ON CONFLICT (repo_id, skill_id) DO UPDATE SET
						name = EXCLUDED.name,
						short_description = EXCLUDED.short_description,
						description = EXCLUDED.description,
						compatibility = EXCLUDED.compatibility,
						content_hash = EXCLUDED.content_hash,
						schema_version = EXCLUDED.schema_version,
						source = EXCLUDED.source,
						metadata = EXCLUDED.metadata,
						parse_warnings = EXCLUDED.parse_warnings,
						search_text = EXCLUDED.search_text,
						raw_markdown = EXCLUDED.raw_markdown,
						raw_compression = EXCLUDED.raw_compression,
						normalized_record = EXCLUDED.normalized_record,
						normalized_compression = EXCLUDED.normalized_compression,
						discovered_at = EXCLUDED.discovered_at,
						indexed_at = EXCLUDED.indexed_at,
						updated_at = EXCLUDED.updated_at
				`;
			}

			const cacheEntries = buildDefaultPositiveCacheEntries(repoId, recordsToPersist);
			for (const entry of cacheEntries) {
				await transaction`
					INSERT INTO skill_positive_cache (
						repo_id,
						lookup_key,
						skill_name,
						content_hash,
						read_signature,
						payload,
						created_at
					)
					VALUES (
						${entry.repoId},
						${entry.lookupKey},
						${entry.skillName},
						${entry.contentHash},
						${entry.readSignature},
						${JSON.stringify(entry.payload)}::jsonb,
						${entry.createdAt}
					)
				`;
			}

			const negativeNames = targetedNames
				? requestedNames.filter((name) => !targetNames.has(name))
				: [];
			for (const lookupKey of negativeNames) {
				await transaction`
					INSERT INTO skill_negative_cache (
						repo_id,
						lookup_key,
						created_at,
						expires_at
					)
					VALUES (
						${repoId},
						${lookupKey},
						${nowIso},
						${new Date(
							Date.now() + config.skills.cache.negativeCache.ttlSeconds * 1_000,
						).toISOString()}
					)
					ON CONFLICT (repo_id, lookup_key) DO UPDATE SET
						created_at = EXCLUDED.created_at,
						expires_at = EXCLUDED.expires_at
				`;
			}

			if (config.skills.embeddings.enabled) {
				for (const record of dirtyEmbeddingRecords) {
					await transaction`
						DELETE FROM skill_embeddings
						WHERE repo_id = ${repoId}
							AND skill_id = ${record.id}
							AND target_type = 'summary'
					`;
				}

				if (providerResolution.providers.length > 0 && dirtyEmbeddingRecords.length > 0) {
					const embeddingBatch = await createTextEmbeddings({
						inputs: dirtyEmbeddingRecords.map((record) => buildSkillEmbeddingText(record)),
						providers: providerResolution.providers,
						enabled: true,
						fallbackOnFailure: config.skills.embeddings.fallbackOnFailure,
					});
					if (embeddingBatch) {
						embeddingsReindexed = dirtyEmbeddingRecords.length;
						diagnostics.push(...embeddingBatch.diagnostics);
						for (const [index, record] of dirtyEmbeddingRecords.entries()) {
							const vector = embeddingBatch.vectors[index];
							if (!vector) {
								continue;
							}
							await transaction`
								INSERT INTO skill_embeddings (
									repo_id,
									skill_id,
									target_type,
									target_key,
									model,
									dims,
									embedding_hash,
									provider_type,
									vector,
									created_at
								)
								VALUES (
									${repoId},
									${record.id},
									${"summary"},
									${"memory"},
									${embeddingBatch.model},
									${embeddingBatch.dims},
									${hashDeterministic({
										model: embeddingBatch.model,
										contentHash: record.contentHash,
										targetType: "summary",
										targetKey: "memory",
									})},
									${embeddingBatch.providerType},
									${vectorLiteral(vector)}::vector,
									${nowIso}
								)
							`;
						}
					} else {
						diagnostics.push(
							"Embedding reindex skipped because no configured provider returned vectors.",
						);
					}
				}
			}
		});

		const nextState = createMirroredState(baseState, {
			updatedAt: nowIso,
			configHash: hashValue(config.skills),
			readiness: {
				...baseState.readiness,
				state:
					schema.appliedVersions.length > 0 || recordsToPersist.length > 0 ? "ready" : "degraded",
				checkedAt: nowIso,
				configHash: hashValue(config.skills),
				embeddingsEnabled: config.skills.embeddings.enabled,
				providerCount: config.skills.embeddings.providers.length,
				reasons:
					recordsToPersist.length > 0
						? diagnostics
						: ["No skills are currently indexed for this repository.", ...diagnostics],
			},
			lastIndexedAt: nowIso,
		});
		await persistStateRow(sql, nextState);

		const refreshedState = await loadSkillRegistrySnapshot(projectRoot, config);
		return {
			state: refreshedState,
			response: refreshResponseForState({
				projectRoot,
				scope: request.scope === "all" ? "all" : "repo",
				refreshed: recordsToPersist,
				invalidatedPositiveCacheEntries,
				invalidatedNegativeCacheEntries,
				embeddingsReindexed,
				diagnostics: [
					`Indexed ${recordsToPersist.length} skill(s) for ${projectRoot}.`,
					...diagnostics,
				],
				state: refreshedState,
			}),
		};
	} finally {
		await sql.close();
	}
};
