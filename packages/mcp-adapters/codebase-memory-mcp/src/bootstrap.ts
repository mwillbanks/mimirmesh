import type { EngineBootstrapDefinition } from "../../src/types";

export const codebaseMemoryBootstrap: EngineBootstrapDefinition = {
  required: true,
  mode: "tool",
  tool: "index_repository",
  args: (_projectRoot, config) => {
    const settings = config.engines["codebase-memory-mcp"].settings as {
      repoPath: string;
      forceReindex: boolean;
    };
    return {
      repo_path: settings.repoPath,
      mode: settings.forceReindex ? "full" : "fast",
    };
  },
};
