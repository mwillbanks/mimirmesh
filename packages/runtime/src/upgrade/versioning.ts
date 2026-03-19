import { access } from "node:fs/promises";

import type {
	ProjectRuntimeVersionRecord,
	RuntimeUpgradeDriftCategory,
	UpgradeStatusReport,
} from "@mimirmesh/config";

import { loadVersionRecord } from "../state/io";
import {
	bootstrapStatePath,
	connectionPath,
	engineStatePath,
	enginesStateDir,
	healthPath,
	routingTablePath,
} from "../state/paths";

export const CURRENT_RUNTIME_VERSION = "1.0.0";
export const CURRENT_RUNTIME_SCHEMA_VERSION = 4;
export const CURRENT_ENGINE_DEFINITION_VERSION = "5";
export const CURRENT_STATE_COMPATIBILITY_VERSION = "safe-local-upgrade-v1";
export const MIN_AUTOMATIC_RUNTIME_SCHEMA_VERSION = 1;

const requiredLegacyPaths = [connectionPath, healthPath, routingTablePath, bootstrapStatePath];

const pathExists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

const parseVersionNumber = (value: string): number[] =>
	value
		.split(".")
		.map((segment) => Number.parseInt(segment, 10))
		.filter((segment) => Number.isFinite(segment));

const compareLooseVersion = (left: string, right: string): number => {
	const leftParts = parseVersionNumber(left);
	const rightParts = parseVersionNumber(right);
	const length = Math.max(leftParts.length, rightParts.length);

	for (let index = 0; index < length; index += 1) {
		const leftValue = leftParts[index] ?? 0;
		const rightValue = rightParts[index] ?? 0;
		if (leftValue === rightValue) {
			continue;
		}
		return leftValue > rightValue ? 1 : -1;
	}

	return 0;
};

export const createTargetVersionRecord = (
	generatedBy: string,
	overrides: Partial<ProjectRuntimeVersionRecord> = {},
): ProjectRuntimeVersionRecord => {
	const recordedAt = new Date().toISOString();
	return {
		runtimeVersion: overrides.runtimeVersion ?? CURRENT_RUNTIME_VERSION,
		schemaVersion: overrides.schemaVersion ?? CURRENT_RUNTIME_SCHEMA_VERSION,
		lastUpgrade: overrides.lastUpgrade ?? recordedAt,
		cliVersion: overrides.cliVersion ?? CURRENT_RUNTIME_VERSION,
		runtimeSchemaVersion: overrides.runtimeSchemaVersion ?? CURRENT_RUNTIME_SCHEMA_VERSION,
		engineDefinitionVersion: overrides.engineDefinitionVersion ?? CURRENT_ENGINE_DEFINITION_VERSION,
		stateCompatibilityVersion:
			overrides.stateCompatibilityVersion ?? CURRENT_STATE_COMPATIBILITY_VERSION,
		recordedAt: overrides.recordedAt ?? recordedAt,
		generatedBy: overrides.generatedBy ?? generatedBy,
	};
};

const inferLegacyVersionRecord = async (
	projectRoot: string,
): Promise<ProjectRuntimeVersionRecord | null> => {
	const requiredPathsPresent = await Promise.all(
		requiredLegacyPaths.map((resolver) => pathExists(resolver(projectRoot))),
	);
	if (requiredPathsPresent.some((present) => !present)) {
		return null;
	}

	const engineStateDir = enginesStateDir(projectRoot);
	const hasEngineState = await pathExists(engineStateDir);
	if (!hasEngineState) {
		return null;
	}

	const knownEngines = ["srclight", "document-mcp", "mcp-adr-analysis-server"];
	const engineStatePresent = await Promise.all(
		knownEngines.map((engine) => pathExists(engineStatePath(projectRoot, engine))),
	);
	if (engineStatePresent.every((present) => !present)) {
		return null;
	}

	return {
		runtimeVersion: "legacy",
		schemaVersion: 1,
		lastUpgrade: null,
		cliVersion: "legacy",
		runtimeSchemaVersion: 1,
		engineDefinitionVersion: "1",
		stateCompatibilityVersion: CURRENT_STATE_COMPATIBILITY_VERSION,
		recordedAt: new Date().toISOString(),
		generatedBy: "legacy-detection",
	};
};

export const detectProjectRuntimeVersion = async (
	projectRoot: string,
): Promise<ProjectRuntimeVersionRecord | null> => {
	const recorded = await loadVersionRecord(projectRoot);
	if (recorded) {
		return recorded;
	}

	return inferLegacyVersionRecord(projectRoot);
};

export const isAutomaticMigrationAllowed = (
	record: ProjectRuntimeVersionRecord | null,
	target = createTargetVersionRecord("version-check"),
): boolean => {
	if (!record) {
		return false;
	}
	if (record.runtimeSchemaVersion > target.runtimeSchemaVersion) {
		return false;
	}
	if (record.runtimeSchemaVersion < MIN_AUTOMATIC_RUNTIME_SCHEMA_VERSION) {
		return false;
	}
	return record.stateCompatibilityVersion === target.stateCompatibilityVersion;
};

export const collectVersionDrift = (
	current: ProjectRuntimeVersionRecord | null,
	target = createTargetVersionRecord("version-check"),
): RuntimeUpgradeDriftCategory[] => {
	if (!current) {
		return ["runtime-metadata", "compatibility-window"];
	}

	const drift = new Set<RuntimeUpgradeDriftCategory>();
	if (current.runtimeSchemaVersion !== target.runtimeSchemaVersion) {
		drift.add("runtime-metadata");
	}
	if (compareLooseVersion(current.engineDefinitionVersion, target.engineDefinitionVersion) !== 0) {
		drift.add("compose-definition");
		drift.add("engine-image");
	}
	if (current.stateCompatibilityVersion !== target.stateCompatibilityVersion) {
		drift.add("compatibility-window");
	}
	return [...drift];
};

export const requiresMigration = (
	current: ProjectRuntimeVersionRecord | null,
	target = createTargetVersionRecord("version-check"),
): boolean => {
	if (!current) {
		return false;
	}
	return (
		current.runtimeSchemaVersion < target.runtimeSchemaVersion ||
		compareLooseVersion(current.engineDefinitionVersion, target.engineDefinitionVersion) < 0
	);
};

export const reportVersionDelta = (
	current: ProjectRuntimeVersionRecord | null,
	target = createTargetVersionRecord("version-check"),
): Pick<UpgradeStatusReport, "currentVersion" | "targetVersion" | "automaticMigrationAllowed"> => ({
	currentVersion: current,
	targetVersion: target,
	automaticMigrationAllowed: isAutomaticMigrationAllowed(current, target),
});
