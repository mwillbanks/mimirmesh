import { mkdir, readFile } from "node:fs/promises";

import { parse } from "yaml";

import { createDefaultConfig } from "../defaults";
import { getConfigPath, getMimirmeshDir } from "../paths";
import { type ConfigValidationResult, type MimirmeshConfig, validateConfigValue } from "../schema";
import {
	migrateCodebaseMemoryConfigValue,
	persistMigratedCodebaseMemoryConfig,
} from "./migrate-codebase-memory";

export const ensureConfigParent = async (projectRoot: string): Promise<void> => {
	await mkdir(getMimirmeshDir(projectRoot), { recursive: true });
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
