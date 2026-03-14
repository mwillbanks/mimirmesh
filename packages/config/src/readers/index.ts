import { mkdir, readFile } from "node:fs/promises";

import { parse } from "yaml";

import { createDefaultConfig } from "../defaults";
import { getConfigPath, getMimirmeshDir } from "../paths";
import { type ConfigValidationResult, type MimirmeshConfig, validateConfigValue } from "../schema";

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
		const validation = validateConfigValue(parsedYaml);
		if (!validation.ok || !validation.config) {
			throw new Error(`Invalid config at ${configPath}\n${validation.errors.join("\n")}`);
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
