import type { MimirmeshConfig } from "@mimirmesh/config";

import type { EngineConfigTranslationResult } from "../../src/types";
import type { SrclightSettings } from "./types";

const readSettings = (config: MimirmeshConfig): SrclightSettings => {
	return config.engines.srclight.settings as SrclightSettings;
};

export const translateSrclightConfig = (
	_projectRoot: string,
	config: MimirmeshConfig,
): EngineConfigTranslationResult => {
	const engine = config.engines.srclight;
	const settings = readSettings(config);
	const errors: string[] = [];
	const embeddingEnabled = Boolean(settings.embedModel && settings.ollamaBaseUrl);
	const embeddingPartiallyConfigured =
		Boolean(settings.embedModel || settings.ollamaBaseUrl) && !embeddingEnabled;

	if (!settings.rootPath.trim()) {
		errors.push("srclight.settings.rootPath is required");
	}

	const degradedReasons: string[] = [];
	if (embeddingPartiallyConfigured) {
		degradedReasons.push(
			"semantic capabilities disabled until both srclight.settings.embedModel and srclight.settings.ollamaBaseUrl are configured",
		);
	}

	return {
		contract: {
			id: "srclight",
			namespace: engine.namespace,
			serviceName: engine.serviceName,
			required: engine.required,
			dockerfile: engine.image.dockerfile,
			context: engine.image.context,
			imageTag: engine.image.tag,
			bridgePort: engine.bridge.containerPort,
			bridgeTransport: settings.transport === "sse" ? "sse" : "stdio",
			bridgeUrl: settings.transport === "sse" ? `http://127.0.0.1:${settings.port}/sse` : undefined,
			mounts: {
				repo: engine.mounts.repo,
				mimirmesh: engine.mounts.mimirmesh,
			},
			env: {
				SRCLIGHT_TRANSPORT: settings.transport,
				SRCLIGHT_PORT: String(settings.port),
				SRCLIGHT_ROOT_PATH: settings.rootPath,
				SRCLIGHT_INDEX_ON_START: settings.indexOnStart ? "true" : "false",
				SRCLIGHT_EMBED_MODEL: embeddingEnabled ? (settings.embedModel ?? "") : "",
				OLLAMA_BASE_URL: embeddingEnabled ? (settings.ollamaBaseUrl ?? "") : "",
				SRCLIGHT_EMBED_REQUEST_TIMEOUT: String(settings.embedRequestTimeoutSeconds),
			},
		},
		errors,
		degraded: errors.length > 0 || degradedReasons.length > 0,
		degradedReason:
			errors.length > 0
				? errors.join("; ")
				: degradedReasons.length > 0
					? degradedReasons.join("; ")
					: undefined,
	};
};
