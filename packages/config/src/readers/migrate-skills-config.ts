import { createDefaultSkillsConfig } from "../defaults";
import type { SkillsConfig } from "../schema";

type JsonRecord = Record<string, unknown>;

export type SkillsConfigMigrationResult = {
	changed: boolean;
	value: unknown;
	backfilledFields: string[];
};

const isRecord = (value: unknown): value is JsonRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const assignMissingString = (
	target: JsonRecord,
	key: string,
	candidate: unknown,
	fieldPath: string,
	backfilledFields: string[],
): void => {
	if (typeof target[key] === "string" && `${target[key]}`.trim().length > 0) {
		return;
	}
	if (typeof candidate !== "string" || candidate.trim().length === 0) {
		return;
	}

	target[key] = candidate;
	backfilledFields.push(fieldPath);
};

const assignMissingNumber = (
	target: JsonRecord,
	key: string,
	candidate: unknown,
	fieldPath: string,
	backfilledFields: string[],
): void => {
	if (typeof target[key] === "number") {
		return;
	}
	if (typeof candidate !== "number") {
		return;
	}

	target[key] = candidate;
	backfilledFields.push(fieldPath);
};

const assignMissingBoolean = (
	target: JsonRecord,
	key: string,
	candidate: unknown,
	fieldPath: string,
	backfilledFields: string[],
): void => {
	if (typeof target[key] === "boolean") {
		return;
	}
	if (typeof candidate !== "boolean") {
		return;
	}

	target[key] = candidate;
	backfilledFields.push(fieldPath);
};

const assignMissingStringArray = (
	target: JsonRecord,
	key: string,
	candidate: unknown,
	fieldPath: string,
	backfilledFields: string[],
): void => {
	if (Array.isArray(target[key])) {
		return;
	}
	if (!Array.isArray(candidate) || candidate.some((entry) => typeof entry !== "string")) {
		return;
	}

	target[key] = [...candidate];
	backfilledFields.push(fieldPath);
};

const backfillMissingSkillsConfig = (target: JsonRecord, backfilledFields: string[]): void => {
	const defaults = createDefaultSkillsConfig() as SkillsConfig & JsonRecord;

	let skills: JsonRecord;
	if (isRecord(target.skills)) {
		skills = target.skills;
	} else {
		skills = {};
		target.skills = skills;
		backfilledFields.push("skills");
	}

	assignMissingStringArray(
		skills,
		"alwaysLoad",
		defaults.alwaysLoad,
		"skills.alwaysLoad",
		backfilledFields,
	);

	let resolve: JsonRecord;
	if (isRecord(skills.resolve)) {
		resolve = skills.resolve;
	} else {
		resolve = {};
		skills.resolve = resolve;
		backfilledFields.push("skills.resolve");
	}

	assignMissingStringArray(
		resolve,
		"precedence",
		defaults.resolve.precedence,
		"skills.resolve.precedence",
		backfilledFields,
	);
	assignMissingNumber(
		resolve,
		"limit",
		defaults.resolve.limit,
		"skills.resolve.limit",
		backfilledFields,
	);

	let read: JsonRecord;
	if (isRecord(skills.read)) {
		read = skills.read;
	} else {
		read = {};
		skills.read = read;
		backfilledFields.push("skills.read");
	}

	assignMissingString(
		read,
		"defaultMode",
		defaults.read.defaultMode,
		"skills.read.defaultMode",
		backfilledFields,
	);
	assignMissingString(
		read,
		"progressiveDisclosure",
		defaults.read.progressiveDisclosure,
		"skills.read.progressiveDisclosure",
		backfilledFields,
	);

	let cache: JsonRecord;
	if (isRecord(skills.cache)) {
		cache = skills.cache;
	} else {
		cache = {};
		skills.cache = cache;
		backfilledFields.push("skills.cache");
	}

	let negativeCache: JsonRecord;
	if (isRecord(cache.negativeCache)) {
		negativeCache = cache.negativeCache;
	} else {
		negativeCache = {};
		cache.negativeCache = negativeCache;
		backfilledFields.push("skills.cache.negativeCache");
	}

	assignMissingBoolean(
		negativeCache,
		"enabled",
		defaults.cache.negativeCache.enabled,
		"skills.cache.negativeCache.enabled",
		backfilledFields,
	);
	assignMissingNumber(
		negativeCache,
		"ttlSeconds",
		defaults.cache.negativeCache.ttlSeconds,
		"skills.cache.negativeCache.ttlSeconds",
		backfilledFields,
	);

	let compression: JsonRecord;
	if (isRecord(skills.compression)) {
		compression = skills.compression;
	} else {
		compression = {};
		skills.compression = compression;
		backfilledFields.push("skills.compression");
	}

	assignMissingBoolean(
		compression,
		"enabled",
		defaults.compression.enabled,
		"skills.compression.enabled",
		backfilledFields,
	);
	assignMissingString(
		compression,
		"algorithm",
		defaults.compression.algorithm,
		"skills.compression.algorithm",
		backfilledFields,
	);
	assignMissingString(
		compression,
		"fallbackAlgorithm",
		defaults.compression.fallbackAlgorithm,
		"skills.compression.fallbackAlgorithm",
		backfilledFields,
	);
	assignMissingString(
		compression,
		"profile",
		defaults.compression.profile,
		"skills.compression.profile",
		backfilledFields,
	);

	let embeddings: JsonRecord;
	if (isRecord(skills.embeddings)) {
		embeddings = skills.embeddings;
	} else {
		embeddings = {};
		skills.embeddings = embeddings;
		backfilledFields.push("skills.embeddings");
	}

	assignMissingBoolean(
		embeddings,
		"enabled",
		defaults.embeddings.enabled,
		"skills.embeddings.enabled",
		backfilledFields,
	);
	assignMissingBoolean(
		embeddings,
		"fallbackOnFailure",
		defaults.embeddings.fallbackOnFailure,
		"skills.embeddings.fallbackOnFailure",
		backfilledFields,
	);
	assignMissingStringArray(
		embeddings,
		"providers",
		defaults.embeddings.providers,
		"skills.embeddings.providers",
		backfilledFields,
	);
};

export const migrateSkillsConfigValue = (value: unknown): SkillsConfigMigrationResult => {
	if (!isRecord(value)) {
		return {
			changed: false,
			value,
			backfilledFields: [],
		};
	}

	const hasSkillsConfig = isRecord(value.skills);
	if (hasSkillsConfig) {
		const migrated = structuredClone(value) as JsonRecord;
		const backfilledFields: string[] = [];
		backfillMissingSkillsConfig(migrated, backfilledFields);
		return {
			changed: backfilledFields.length > 0,
			value: migrated,
			backfilledFields,
		};
	}

	const migrated = structuredClone(value) as JsonRecord;
	migrated.skills = createDefaultSkillsConfig();

	return {
		changed: true,
		value: migrated,
		backfilledFields: ["skills"],
	};
};
