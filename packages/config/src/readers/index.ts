import { mkdir, readFile } from "node:fs/promises";

import { parse } from "yaml";
import { createDefaultConfig, createDefaultGlobalConfig } from "../defaults";
import {
	getConfigPath,
	getGlobalConfigPath,
	getGlobalMimirmeshDir,
	getMimirmeshDir,
} from "../paths";
import {
	type ConfigValidationResult,
	type GlobalConfigValidationResult,
	type MimirmeshConfig,
	type MimirmeshGlobalConfig,
	validateConfigValue,
	validateGlobalConfigValue,
} from "../schema";
import {
	migrateCodebaseMemoryConfigValue,
	persistMigratedCodebaseMemoryConfig,
} from "./migrate-codebase-memory";

export const ensureConfigParent = async (projectRoot: string): Promise<void> => {
	await mkdir(getMimirmeshDir(projectRoot), { recursive: true });
};

export const ensureGlobalConfigParent = async (
	homeDirectory = process.env.MIMIRMESH_HOME ?? process.env.HOME ?? ".",
): Promise<void> => {
	await mkdir(getGlobalMimirmeshDir(homeDirectory), { recursive: true });
};

export const readConfig = async (
	projectRoot: string,
	options: { createIfMissing?: boolean } = {},
): Promise<MimirmeshConfig> => {
	const configPath = getConfigPath(projectRoot);
	const createIfMissing = options.createIfMissing ?? true;

	try {
		const raw = await readFile(configPath, "utf8");
		const parsedYaml = parse(raw);
		const migration = migrateCodebaseMemoryConfigValue(parsedYaml);
		const validation = validateConfigValue(migration.value);
		if (!validation.ok || !validation.config) {
			if (migration.changed) {
				throw new Error(
					[
						`Legacy codebase-memory config migration failed for ${configPath}.`,
						...validation.errors,
						"Remediation: remove the retired engines.codebase-memory-mcp block or add the missing Srclight fields, then retry.",
					].join("\n"),
				);
			}
			throw new Error(`Invalid config at ${configPath}\n${validation.errors.join("\n")}`);
		}
		if (migration.changed) {
			await persistMigratedCodebaseMemoryConfig(configPath, validation.config);
		}
		return validation.config;
	} catch (error) {
		const missing = `${error}`.includes("ENOENT");
		if (!createIfMissing || !missing) {
			throw error;
		}
		const created = createDefaultConfig(projectRoot);
		const { writeConfig } = await import("../writers");
		await writeConfig(projectRoot, created);
		return created;
	}
};

export const validateConfigFile = async (projectRoot: string): Promise<ConfigValidationResult> => {
	const configPath = getConfigPath(projectRoot);
	try {
		const raw = await readFile(configPath, "utf8");
		return validateConfigValue(parse(raw));
	} catch (error) {
		return {
			ok: false,
			errors: [`Unable to read config at ${configPath}: ${String(error)}`],
		};
	}
};

export const readGlobalConfig = async (
	options: { createIfMissing?: boolean; homeDirectory?: string } = {},
): Promise<MimirmeshGlobalConfig> => {
	const homeDirectory =
		options.homeDirectory ?? process.env.MIMIRMESH_HOME ?? process.env.HOME ?? ".";
	const configPath = getGlobalConfigPath(homeDirectory);
	const createIfMissing = options.createIfMissing ?? true;

	try {
		const raw = await readFile(configPath, "utf8");
		const validation = validateGlobalConfigValue(parse(raw));
		if (!validation.ok || !validation.config) {
			throw new Error(`Invalid global config at ${configPath}\n${validation.errors.join("\n")}`);
		}
		return validation.config;
	} catch (error) {
		const missing = `${error}`.includes("ENOENT");
		if (!createIfMissing || !missing) {
			throw error;
		}
		const created = createDefaultGlobalConfig();
		const { writeGlobalConfig } = await import("../writers");
		await writeGlobalConfig(created, { homeDirectory });
		return created;
	}
};

export const validateGlobalConfigFile = async (
	homeDirectory = process.env.MIMIRMESH_HOME ?? process.env.HOME ?? ".",
): Promise<GlobalConfigValidationResult> => {
	const configPath = getGlobalConfigPath(homeDirectory);

	try {
		const raw = await readFile(configPath, "utf8");
		return validateGlobalConfigValue(parse(raw));
	} catch (error) {
		return {
			ok: false,
			errors: [`Unable to read global config at ${configPath}: ${String(error)}`],
		};
	}
};
