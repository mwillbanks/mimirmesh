import { writeFile } from "node:fs/promises";

import { stringify } from "yaml";
import { getConfigPath } from "../paths";
import { ensureConfigParent } from "../readers";
import type { MimirmeshConfig, SkillsConfig } from "../schema";
import { validateConfigValue } from "../schema";

export const writeSkillsConfig = async (
	projectRoot: string,
	config: MimirmeshConfig,
	skills: SkillsConfig,
): Promise<void> => {
	await ensureConfigParent(projectRoot);
	const configPath = getConfigPath(projectRoot);
	const nextConfig: MimirmeshConfig = {
		...config,
		skills,
	};
	const validation = validateConfigValue(nextConfig);
	if (!validation.ok || !validation.config) {
		throw new Error(`Refusing to write invalid skills config:\n${validation.errors.join("\n")}`);
	}
	await writeFile(configPath, stringify(validation.config), "utf8");
};
