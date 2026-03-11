import type { EngineBootstrapDefinition } from "../../src/types";

export const srclightBootstrap: EngineBootstrapDefinition = {
  required: true,
  mode: "command",
  command: "srclight",
  args: (_projectRoot, config) => {
    const settings = config.engines.srclight.settings as {
      rootPath: string;
      embedModel: string | null;
      ollamaBaseUrl: string | null;
    };
    const embeddingEnabled = Boolean(settings.embedModel && settings.ollamaBaseUrl);

    return [
      "index",
      settings.rootPath,
      ...(embeddingEnabled ? ["--embed", settings.embedModel as string] : []),
    ];
  },
};
