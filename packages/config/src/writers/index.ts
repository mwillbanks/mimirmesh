import { writeFile } from "node:fs/promises";

import { stringify } from "yaml";
import { getConfigPath, getGlobalConfigPath } from "../paths";
import { ensureConfigParent, ensureGlobalConfigParent } from "../readers";
import {
	type MimirmeshConfig,
	type MimirmeshGlobalConfig,
	validateConfigValue,
	validateGlobalConfigValue,
} from "../schema";

export const writeConfig = async (projectRoot: string, config: MimirmeshConfig): Promise<void> => {
	await ensureConfigParent(projectRoot);
	const configPath = getConfigPath(projectRoot);
	const validation = validateConfigValue(config);
	if (!validation.ok || !validation.config) {
		throw new Error(`Refusing to write invalid config:\n${validation.errors.join("\n")}`);
	}
	await writeFile(configPath, stringify(validation.config), "utf8");
};

export const writeGlobalConfig = async (
	config: MimirmeshGlobalConfig,
	options: { homeDirectory?: string } = {},
): Promise<void> => {
	const homeDirectory =
		options.homeDirectory ?? process.env.MIMIRMESH_HOME ?? process.env.HOME ?? ".";
	await ensureGlobalConfigParent(homeDirectory);
	const configPath = getGlobalConfigPath(homeDirectory);
	const validation = validateGlobalConfigValue(config);
	if (!validation.ok || !validation.config) {
		throw new Error(`Refusing to write invalid global config:\n${validation.errors.join("\n")}`);
	}
	await writeFile(configPath, stringify(validation.config), "utf8");
};

export { writeSkillsConfig } from "./skills";
