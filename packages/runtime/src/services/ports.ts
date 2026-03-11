import type { EngineId, MimirmeshConfig } from "@mimirmesh/config";
import { getAdapter } from "@mimirmesh/mcp-adapters";

import { composePort } from "./compose";

export const resolveBridgePorts = async (
  config: MimirmeshConfig,
  engines: EngineId[],
): Promise<Partial<Record<EngineId, number>>> => {
  const mapped: Partial<Record<EngineId, number>> = {};
  for (const engine of engines) {
    const adapter = getAdapter(engine);
    const translated = adapter.translateConfig(config.project.rootPath, config).contract;
    const port = await composePort(config, translated.serviceName, translated.bridgePort);
    if (port) {
      mapped[engine] = port;
    }
  }
  return mapped;
};
