import { writeFile } from "node:fs/promises";

import { stringify } from "yaml";

import type { MimirmeshConfig } from "../schema";

const retiredEngineId = "codebase-memory-mcp";
const defaultDeferredEngineGroups = ["srclight", "document-mcp", "mcp-adr-analysis-server"];

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
	if (!Array.isArray(candidate) || candidate.some((value) => typeof value !== "string")) {
		return;
	}

	target[key] = [...candidate];
	backfilledFields.push(fieldPath);
};

const backfillMissingMcpConfig = (target: JsonRecord, backfilledFields: string[]): void => {
	let mcp: JsonRecord;
	if (isRecord(target.mcp)) {
		mcp = target.mcp;
	} else {
		mcp = {};
		target.mcp = mcp;
		backfilledFields.push("mcp");
	}

	let toolSurface: JsonRecord;
	if (isRecord(mcp.toolSurface)) {
		toolSurface = mcp.toolSurface;
	} else {
		toolSurface = {};
		mcp.toolSurface = toolSurface;
		backfilledFields.push("mcp.toolSurface");
	}

	assignMissingString(
		toolSurface,
		"compressionLevel",
		"balanced",
		"mcp.toolSurface.compressionLevel",
		backfilledFields,
	);
	assignMissingStringArray(
		toolSurface,
		"coreEngineGroups",
		[],
		"mcp.toolSurface.coreEngineGroups",
		backfilledFields,
	);
	assignMissingStringArray(
		toolSurface,
		"deferredEngineGroups",
		defaultDeferredEngineGroups,
		"mcp.toolSurface.deferredEngineGroups",
		backfilledFields,
	);
	assignMissingString(
		toolSurface,
		"deferredVisibility",
		"summary",
		"mcp.toolSurface.deferredVisibility",
		backfilledFields,
	);
	assignMissingBoolean(
		toolSurface,
		"fullSchemaAccess",
		true,
		"mcp.toolSurface.fullSchemaAccess",
		backfilledFields,
	);
	assignMissingString(
		toolSurface,
		"refreshPolicy",
		"explicit",
		"mcp.toolSurface.refreshPolicy",
		backfilledFields,
	);
	assignMissingBoolean(
		toolSurface,
		"allowInvocationLazyLoad",
		true,
		"mcp.toolSurface.allowInvocationLazyLoad",
		backfilledFields,
	);
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
	const retiredEnginePresent = isRecord(engines) && retiredEngineId in engines;
	const missingMcpConfig = !isRecord(value.mcp) || !isRecord((value.mcp as JsonRecord).toolSurface);

	if (!retiredEnginePresent && !missingMcpConfig) {
		return {
			changed: false,
			value,
			backfilledFields: [],
		};
	}

	const migrated = structuredClone(value) as JsonRecord;
	const backfilledFields: string[] = [];
	backfillMissingMcpConfig(migrated, backfilledFields);
	const migratedEngines = migrated.engines;

	if (!retiredEnginePresent) {
		return {
			changed: backfilledFields.length > 0,
			value: migrated,
			backfilledFields,
		};
	}

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
