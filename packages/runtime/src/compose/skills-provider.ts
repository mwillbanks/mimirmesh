import { join } from "node:path";

import type { MimirmeshConfig } from "@mimirmesh/config";

import {
	type NormalizedSkillEmbeddingProvider,
	normalizeEmbeddingProviders,
	type SkillProviderSelection,
} from "../state/skills";

const defaultSkillProviderPort = 8012;

const parsePortFromBaseUrl = (baseUrl: string): number => {
	try {
		const url = new URL(baseUrl);
		if (url.port.trim().length > 0) {
			const parsed = Number.parseInt(url.port, 10);
			if (Number.isFinite(parsed) && parsed > 0) {
				return parsed;
			}
		}
		return url.protocol === "https:" ? 443 : defaultSkillProviderPort;
	} catch {
		return defaultSkillProviderPort;
	}
};

const resolveLocalRuntime = (
	projectRoot: string,
	provider: NormalizedSkillEmbeddingProvider,
	hostGpuAvailable: boolean,
): NonNullable<SkillProviderSelection["localRuntime"]> => {
	const variant = hostGpuAvailable ? "server-cuda" : "server";
	const buildContext = join(projectRoot, ".mimirmesh", "runtime", "images");
	return {
		serviceName: "mm-llama-cpp",
		image: `mimirmesh/mm-llama-cpp:${hostGpuAvailable ? "local-cuda" : "local-cpu"}`,
		baseImage: hostGpuAvailable
			? "ghcr.io/ggml-org/llama.cpp:server-cuda"
			: "ghcr.io/ggml-org/llama.cpp:full",
		variant,
		buildContext,
		dockerfile: join(buildContext, "llama-cpp", "Dockerfile"),
		modelStoragePath: join(projectRoot, ".mimirmesh", "runtime", "skills", "models"),
		healthPath: "/health",
		port: parsePortFromBaseUrl(provider.baseUrl),
	};
};

export const resolveSkillProviderSelection = (
	projectRoot: string,
	config: MimirmeshConfig,
	options: { hostGpuAvailable?: boolean } = {},
): SkillProviderSelection => {
	const providers = normalizeEmbeddingProviders(config.skills.embeddings.providers);
	const enabled = config.skills.embeddings.enabled;

	if (!enabled) {
		return {
			enabled,
			readiness: "ready",
			reasons: [],
			providers,
			selectedProviderIndex: null,
			selectedProviderType: null,
			localRuntime: null,
		};
	}

	if (providers.length === 0) {
		return {
			enabled,
			readiness: "degraded",
			reasons: ["Embeddings are enabled but no providers are configured."],
			providers,
			selectedProviderIndex: null,
			selectedProviderType: null,
			localRuntime: null,
		};
	}

	const selectedProviderIndex = 0;
	const selectedProvider = providers[selectedProviderIndex];
	const hostGpuAvailable = options.hostGpuAvailable ?? false;
	const localRuntime =
		selectedProvider?.type === "llama_cpp"
			? resolveLocalRuntime(projectRoot, selectedProvider, hostGpuAvailable)
			: null;

	return {
		enabled,
		readiness: "ready",
		reasons: [],
		providers,
		selectedProviderIndex,
		selectedProviderType: selectedProvider?.type ?? null,
		localRuntime,
	};
};

export const listSkillProviderServiceNames = (
	projectRoot: string,
	config: MimirmeshConfig,
	options: { hostGpuAvailable?: boolean } = {},
): string[] => {
	const localRuntime = resolveSkillProviderSelection(projectRoot, config, options).localRuntime;
	return localRuntime ? [localRuntime.serviceName] : [];
};
