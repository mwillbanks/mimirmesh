import { writeFile } from "node:fs/promises";

import { stringify } from "yaml";

import type { MimirmeshConfig } from "../schema";

const retiredEngineId = "codebase-memory-mcp";

type JsonRecord = Record<string, unknown>;

export type CodebaseMemoryMigrationResult = {
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
	const current = target[key];
	if (typeof current === "string" && current.trim()) {
		return;
	}
	if (typeof candidate !== "string" || !candidate.trim()) {
		return;
	}

	target[key] = candidate.trim();
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

export const migrateCodebaseMemoryConfigValue = (value: unknown): CodebaseMemoryMigrationResult => {
	if (!isRecord(value)) {
		return {
			changed: false,
			value,
			backfilledFields: [],
		};
	}

	const engines = value.engines;
	if (!isRecord(engines) || !(retiredEngineId in engines)) {
		return {
			changed: false,
			value,
			backfilledFields: [],
		};
	}

	const migrated = structuredClone(value) as JsonRecord;
	const migratedEngines = migrated.engines;
	const backfilledFields: string[] = [];

	if (!isRecord(migratedEngines)) {
		return {
			changed: false,
			value,
			backfilledFields,
		};
	}

	const legacyEngine = migratedEngines[retiredEngineId];
	const srclightEngine = migratedEngines.srclight;

	if (isRecord(legacyEngine) && isRecord(srclightEngine)) {
		const legacySettings = legacyEngine.settings;
		let srclightSettings: JsonRecord;
		if (isRecord(srclightEngine.settings)) {
			srclightSettings = srclightEngine.settings as JsonRecord;
		} else {
			srclightSettings = {};
			srclightEngine.settings = srclightSettings;
		}

		if (isRecord(legacySettings)) {
			assignMissingString(
				srclightSettings,
				"rootPath",
				legacySettings.repoPath,
				"engines.srclight.settings.rootPath",
				backfilledFields,
			);
			assignMissingBoolean(
				srclightSettings,
				"indexOnStart",
				legacySettings.forceReindex,
				"engines.srclight.settings.indexOnStart",
				backfilledFields,
			);
		}
	}

	delete migratedEngines[retiredEngineId];

	return {
		changed: true,
		value: migrated,
		backfilledFields,
	};
};

export const persistMigratedCodebaseMemoryConfig = async (
	configPath: string,
	config: MimirmeshConfig,
): Promise<void> => {
	try {
		await writeFile(configPath, stringify(config), "utf8");
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(
			[
				`Failed to persist migrated legacy codebase-memory config at ${configPath}.`,
				`Write error: ${detail}`,
				"Remediation: fix the config file permissions or path, then retry the command.",
			].join("\n"),
		);
	}
};
