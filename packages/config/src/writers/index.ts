import { writeFile } from "node:fs/promises";

import { stringify } from "yaml";

import { ensureConfigParent } from "../readers";
import { getConfigPath } from "../paths";
import { type MimirmeshConfig, validateConfigValue } from "../schema";

export const writeConfig = async (projectRoot: string, config: MimirmeshConfig): Promise<void> => {
  await ensureConfigParent(projectRoot);
  const configPath = getConfigPath(projectRoot);
  const validation = validateConfigValue(config);
  if (!validation.ok || !validation.config) {
    throw new Error(`Refusing to write invalid config:\n${validation.errors.join("\n")}`);
  }
  await writeFile(configPath, stringify(validation.config), "utf8");
};
