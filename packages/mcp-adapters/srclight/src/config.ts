import type { MimirmeshConfig } from "@mimirmesh/config";

import type { EngineConfigTranslationResult, RuntimeAdapterContext } from "../../src/types";
import type { SrclightSettings } from "./types";

const readSettings = (config: MimirmeshConfig): SrclightSettings => {
	return config.engines.srclight.settings as SrclightSettings;
};

const firstNonEmptyString = (...values: Array<string | null | undefined>): string | null => {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}

	return null;
};

const srclightDockerfileForVariant = (dockerfile: string, runtimeVariant: "cpu" | "cuda"): string =>
	dockerfile.replace(
		/Dockerfile(?:\.cpu)?$/,
		runtimeVariant === "cuda" ? "Dockerfile" : "Dockerfile.cpu",
	);

export const translateSrclightConfig = (
	_projectRoot: string,
	config: MimirmeshConfig,
	context?: RuntimeAdapterContext,
): EngineConfigTranslationResult => {
	const engine = config.engines.srclight;
	const settings = readSettings(config);
	const gpuResolution = context?.gpuResolutions?.srclight;
	const errors: string[] = [];
	const effectiveEmbedModel = firstNonEmptyString(settings.embedModel, settings.defaultEmbedModel);
	const ollamaBaseUrl = firstNonEmptyString(settings.ollamaBaseUrl);
	const embeddingEnabled = Boolean(effectiveEmbedModel && ollamaBaseUrl);
	const embeddingPartiallyConfigured =
		(Boolean(settings.embedModel) ||
			Boolean(settings.defaultEmbedModel) ||
			Boolean(settings.ollamaBaseUrl)) &&
		!embeddingEnabled;

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
			dockerfile: gpuResolution
				? srclightDockerfileForVariant(engine.image.dockerfile, gpuResolution.runtimeVariant)
				: engine.image.dockerfile,
			context: engine.image.context,
			imageTag: engine.image.tag,
			bridgePort: engine.bridge.containerPort,
			bridgeTransport: settings.transport === "sse" ? "sse" : "stdio",
			bridgeUrl: settings.transport === "sse" ? `http://127.0.0.1:${settings.port}/sse` : undefined,
			runtimeVariant: gpuResolution?.runtimeVariant,
			mounts: {
				repo: engine.mounts.repo,
				mimirmesh: engine.mounts.mimirmesh,
			},
			env: {
				SRCLIGHT_TRANSPORT: settings.transport,
				SRCLIGHT_PORT: String(settings.port),
				SRCLIGHT_ROOT_PATH: settings.rootPath,
				SRCLIGHT_INDEX_ON_START: settings.indexOnStart ? "true" : "false",
				SRCLIGHT_EMBED_MODEL: embeddingEnabled ? (effectiveEmbedModel ?? "") : "",
				OLLAMA_BASE_URL: embeddingEnabled ? (ollamaBaseUrl ?? "") : "",
				SRCLIGHT_EMBED_REQUEST_TIMEOUT: String(settings.embedRequestTimeoutSeconds),
				SRCLIGHT_GPU_MODE: gpuResolution?.configuredMode ?? config.runtime.gpuMode,
				SRCLIGHT_GPU_ENABLED: gpuResolution
					? gpuResolution.effectiveUseGpu
						? "true"
						: "false"
					: "",
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
