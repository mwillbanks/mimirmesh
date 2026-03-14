import type { EngineBootstrapDefinition } from "../../src/types";

export const srclightBootstrap: EngineBootstrapDefinition = {
	required: true,
	mode: "command",
	command: "srclight",
	args: (_projectRoot, config) => {
		const settings = config.engines.srclight.settings as {
			rootPath: string;
			embedModel: string | null;
			defaultEmbedModel: string;
			ollamaBaseUrl: string | null;
		};
		const effectiveEmbedModel =
			(typeof settings.embedModel === "string" && settings.embedModel.trim()) ||
			(typeof settings.defaultEmbedModel === "string" && settings.defaultEmbedModel.trim()) ||
			null;
		const embeddingEnabled = Boolean(effectiveEmbedModel && settings.ollamaBaseUrl);

		return [
			"index",
			settings.rootPath,
			...(embeddingEnabled ? ["--embed", effectiveEmbedModel as string] : []),
		];
	},
};
