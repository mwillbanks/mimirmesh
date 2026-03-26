import {
	createDefaultSkillsConfig,
	type SkillEmbeddingProvider,
	type SkillsConfig,
} from "@mimirmesh/config";

export type InstallAreaId = "core" | "ide" | "skills";

export type InstallAreaKind = "required" | "optional";

export type InstallSelectionState = "selected" | "skipped" | "required" | "unavailable";

export type InstallMode = "interactive" | "non-interactive";

export type InstallPresetId = "minimal" | "recommended" | "full";

export type EmbeddingsInstallMode =
	| "disabled"
	| "docker-llama-cpp"
	| "existing-lm-studio"
	| "existing-openai-compatible"
	| "openai";

export type EmbeddingsInstallConfig = {
	mode: EmbeddingsInstallMode;
	model?: string;
	baseUrl?: string;
	apiKey?: string;
	fallbackOnFailure: boolean;
};

export const installTargetCatalog = ["vscode", "cursor", "claude", "codex"] as const;
export const embeddingsInstallModeCatalog = [
	"disabled",
	"docker-llama-cpp",
	"existing-lm-studio",
	"existing-openai-compatible",
	"openai",
] as const;

export const defaultDockerLlamaCppModel = "Qwen/Qwen3-Embedding-0.6B-GGUF";
export const defaultDockerLlamaCppBaseUrl = "http://localhost:8012/v1";
export const defaultLmStudioModel = "text-embedding-nomic-embed-text-v1.5";
export const defaultLmStudioBaseUrl = "http://localhost:1234/v1";
export const defaultOpenAIModel = "text-embedding-3-small";
export const defaultOpenAIBaseUrl = "https://api.openai.com/v1";

export type InstallTarget = (typeof installTargetCatalog)[number];

export type InstallationPreset = {
	id: InstallPresetId;
	label: string;
	description: string;
	recommended: boolean;
	defaultAreas: InstallAreaId[];
};

export type InstallationArea = {
	id: InstallAreaId;
	label: string;
	kind: InstallAreaKind;
	description: string;
	selectionState: InstallSelectionState;
	nonInteractiveSelectable: boolean;
};

export type InstallationPolicy = {
	presetId?: InstallPresetId;
	selectedAreas: InstallAreaId[];
	explicitAreaOverrides: InstallAreaId[];
	mode: InstallMode;
	ideTargets: InstallTarget[];
	selectedSkills: string[];
	embeddings: EmbeddingsInstallConfig;
};

export const installAreaCatalog: readonly Omit<InstallationArea, "selectionState">[] = [
	{
		id: "core",
		label: "Core repository install",
		kind: "required",
		description:
			"Scaffold docs, initialize runtime state, generate reports, bootstrap Spec Kit, and verify readiness.",
		nonInteractiveSelectable: true,
	},
	{
		id: "ide",
		label: "IDE integration",
		kind: "optional",
		description: "Write a project-local MCP configuration file for an IDE or coding agent.",
		nonInteractiveSelectable: true,
	},
	{
		id: "skills",
		label: "Bundled skills",
		kind: "optional",
		description: "Install the bundled repository-local skill set under `.agents/skills/`.",
		nonInteractiveSelectable: true,
	},
] as const;

export const installPresetCatalog: readonly InstallationPreset[] = [
	{
		id: "minimal",
		label: "Minimal",
		description: "Install only the required core repository setup.",
		recommended: false,
		defaultAreas: ["core"],
	},
	{
		id: "recommended",
		label: "Recommended",
		description: "Install the core repository setup plus bundled repository skills.",
		recommended: true,
		defaultAreas: ["core", "skills"],
	},
	{
		id: "full",
		label: "Full",
		description: "Install the core repository setup, bundled skills, and IDE integration.",
		recommended: false,
		defaultAreas: ["core", "ide", "skills"],
	},
] as const;

const withRequiredCore = (areas: InstallAreaId[]): InstallAreaId[] => {
	const ordered: InstallAreaId[] = ["core"];
	for (const area of areas) {
		if (!ordered.includes(area)) {
			ordered.push(area);
		}
	}
	return ordered;
};

export const isInstallAreaId = (value: string): value is InstallAreaId =>
	installAreaCatalog.some((area) => area.id === value);

export const isInstallPresetId = (value: string): value is InstallPresetId =>
	installPresetCatalog.some((preset) => preset.id === value);

export const isEmbeddingsInstallMode = (value: string): value is EmbeddingsInstallMode =>
	embeddingsInstallModeCatalog.includes(value as EmbeddingsInstallMode);

export const resolveInstallPreset = (presetId?: InstallPresetId): InstallationPreset => {
	const fallbackPreset =
		installPresetCatalog.find((preset) => preset.recommended) ?? installPresetCatalog[0];
	if (!fallbackPreset) {
		throw new Error("Install preset catalog is empty.");
	}
	return installPresetCatalog.find((preset) => preset.id === presetId) ?? fallbackPreset;
};

export const resolveInstallAreas = (
	presetId?: InstallPresetId,
	explicitAreas?: InstallAreaId[],
): InstallAreaId[] =>
	explicitAreas && explicitAreas.length > 0
		? withRequiredCore(explicitAreas)
		: withRequiredCore(resolveInstallPreset(presetId).defaultAreas);

export const createInstallationAreas = (selectedAreas: InstallAreaId[]): InstallationArea[] =>
	installAreaCatalog.map((area) => ({
		...area,
		selectionState:
			area.kind === "required"
				? "required"
				: selectedAreas.includes(area.id)
					? "selected"
					: "skipped",
	}));

export const createDefaultEmbeddingsInstallConfig = (
	presetId?: InstallPresetId,
): EmbeddingsInstallConfig =>
	presetId === "minimal" || !presetId
		? {
				mode: "disabled",
				fallbackOnFailure: true,
			}
		: {
				mode: "docker-llama-cpp",
				model: defaultDockerLlamaCppModel,
				baseUrl: defaultDockerLlamaCppBaseUrl,
				fallbackOnFailure: true,
			};

export const resolveEmbeddingsInstallConfig = (options: {
	presetId?: InstallPresetId;
	selectedAreas?: InstallAreaId[];
	embeddings?: Partial<EmbeddingsInstallConfig>;
}): EmbeddingsInstallConfig => {
	const skillsSelected = (options.selectedAreas ?? []).includes("skills");
	if (!skillsSelected) {
		return {
			mode: "disabled",
			fallbackOnFailure: options.embeddings?.fallbackOnFailure ?? true,
		};
	}

	const base = createDefaultEmbeddingsInstallConfig(options.presetId);
	const mode = options.embeddings?.mode ?? base.mode;
	const fallbackOnFailure = options.embeddings?.fallbackOnFailure ?? base.fallbackOnFailure;

	if (mode === "disabled") {
		return {
			mode,
			fallbackOnFailure,
		};
	}
	if (mode === "docker-llama-cpp") {
		return {
			mode,
			model: options.embeddings?.model?.trim() || base.model || defaultDockerLlamaCppModel,
			baseUrl: options.embeddings?.baseUrl?.trim() || base.baseUrl || defaultDockerLlamaCppBaseUrl,
			fallbackOnFailure,
		};
	}
	if (mode === "existing-lm-studio") {
		return {
			mode,
			model: options.embeddings?.model?.trim() || defaultLmStudioModel,
			baseUrl: options.embeddings?.baseUrl?.trim() || defaultLmStudioBaseUrl,
			apiKey: options.embeddings?.apiKey?.trim() || undefined,
			fallbackOnFailure,
		};
	}
	if (mode === "openai") {
		return {
			mode,
			model: options.embeddings?.model?.trim() || defaultOpenAIModel,
			baseUrl: options.embeddings?.baseUrl?.trim() || defaultOpenAIBaseUrl,
			apiKey: options.embeddings?.apiKey?.trim() || undefined,
			fallbackOnFailure,
		};
	}
	return {
		mode,
		model: options.embeddings?.model?.trim() || "",
		baseUrl: options.embeddings?.baseUrl?.trim() || "",
		apiKey: options.embeddings?.apiKey?.trim() || undefined,
		fallbackOnFailure,
	};
};

export const describeEmbeddingsInstallConfig = (config: EmbeddingsInstallConfig): string => {
	if (config.mode === "disabled") {
		return "Embeddings strategy: disabled.";
	}
	if (config.mode === "docker-llama-cpp") {
		return `Embeddings strategy: Docker-managed llama.cpp (${config.model ?? defaultDockerLlamaCppModel} via ${config.baseUrl ?? defaultDockerLlamaCppBaseUrl}).`;
	}
	if (config.mode === "existing-lm-studio") {
		return `Embeddings strategy: existing LM Studio runtime (${config.model ?? defaultLmStudioModel} via ${config.baseUrl ?? defaultLmStudioBaseUrl}).`;
	}
	if (config.mode === "openai") {
		return `Embeddings strategy: OpenAI API (${config.model ?? defaultOpenAIModel}).`;
	}
	return `Embeddings strategy: existing OpenAI-compatible runtime (${config.model ?? "custom model"} via ${config.baseUrl ?? "custom base URL"}).`;
};

export const createInstallationPolicy = (options: {
	presetId?: InstallPresetId;
	selectedAreas?: InstallAreaId[];
	explicitAreaOverrides?: InstallAreaId[];
	mode: InstallMode;
	ideTargets?: InstallTarget[];
	selectedSkills?: string[];
	embeddings?: Partial<EmbeddingsInstallConfig>;
}): InstallationPolicy => {
	const explicitAreaOverrides = withRequiredCore(options.explicitAreaOverrides ?? []);
	const selectedAreas = withRequiredCore(
		options.selectedAreas?.length ? options.selectedAreas : resolveInstallAreas(options.presetId),
	);

	return {
		presetId: options.presetId,
		selectedAreas,
		explicitAreaOverrides,
		mode: options.mode,
		ideTargets: [...new Set(options.ideTargets ?? [])],
		selectedSkills: options.selectedSkills ?? [],
		embeddings: resolveEmbeddingsInstallConfig({
			presetId: options.presetId,
			selectedAreas,
			embeddings: options.embeddings,
		}),
	};
};

export const validateInstallationPolicy = (
	policy: InstallationPolicy,
): { ok: boolean; errors: string[] } => {
	const errors: string[] = [];
	const selectedAreas = withRequiredCore(policy.selectedAreas);

	if (
		policy.mode === "non-interactive" &&
		!policy.presetId &&
		policy.explicitAreaOverrides.length === 0
	) {
		errors.push(
			"Non-interactive install requires an explicit preset or explicit install-area selections.",
		);
	}

	if (
		selectedAreas.includes("ide") &&
		policy.mode === "non-interactive" &&
		policy.ideTargets.length === 0
	) {
		errors.push(
			"Non-interactive install requires `--ide <target[,target]>` when IDE integration is selected.",
		);
	}

	if (selectedAreas.includes("skills")) {
		const embeddings = resolveEmbeddingsInstallConfig({
			presetId: policy.presetId,
			selectedAreas,
			embeddings: policy.embeddings,
		});

		if (embeddings.mode === "openai" && !embeddings.apiKey?.trim()) {
			errors.push(
				"OpenAI embeddings require `--embeddings-api-key` or an interactive prompt value.",
			);
		}
		if (embeddings.mode === "existing-openai-compatible") {
			if (!embeddings.baseUrl?.trim()) {
				errors.push(
					"Existing OpenAI-compatible embeddings require `--embeddings-base-url` or an interactive prompt value.",
				);
			}
			if (!embeddings.model?.trim()) {
				errors.push(
					"Existing OpenAI-compatible embeddings require `--embeddings-model` or an interactive prompt value.",
				);
			}
			if (!embeddings.apiKey?.trim()) {
				errors.push(
					"Existing OpenAI-compatible embeddings require `--embeddings-api-key` or an interactive prompt value.",
				);
			}
		}
	}

	return {
		ok: errors.length === 0,
		errors,
	};
};

export type SkillProviderDefaultsOptions = {
	localBaseUrl?: string;
	localModel?: string;
	remoteFallbackProviders?: SkillEmbeddingProvider[];
};

export const createSkillProviderDefaults = (
	options: SkillProviderDefaultsOptions = {},
): SkillEmbeddingProvider[] => {
	const providers: SkillEmbeddingProvider[] = [
		{
			type: "llama_cpp",
			model: options.localModel ?? defaultDockerLlamaCppModel,
			baseUrl: options.localBaseUrl ?? defaultDockerLlamaCppBaseUrl,
			timeoutMs: 30_000,
			maxRetries: 2,
		},
	];

	for (const provider of options.remoteFallbackProviders ?? []) {
		providers.push(provider);
	}

	return providers;
};

export const createEmbeddingsSkillConfig = (
	config: EmbeddingsInstallConfig,
): SkillsConfig["embeddings"] => {
	if (config.mode === "disabled") {
		return {
			enabled: false,
			fallbackOnFailure: config.fallbackOnFailure,
			providers: [],
		};
	}

	const common = {
		model: config.model ?? "",
		baseUrl: config.baseUrl ?? "",
		timeoutMs: 30_000,
		maxRetries: 2,
	};

	if (config.mode === "docker-llama-cpp") {
		return {
			enabled: true,
			fallbackOnFailure: config.fallbackOnFailure,
			providers: [
				{
					type: "llama_cpp",
					...common,
				},
			],
		};
	}
	if (config.mode === "existing-lm-studio") {
		return {
			enabled: true,
			fallbackOnFailure: config.fallbackOnFailure,
			providers: [
				{
					type: "lm_studio",
					...common,
					...(config.apiKey?.trim() ? { apiKey: config.apiKey.trim() } : {}),
				},
			],
		};
	}
	if (config.mode === "openai") {
		return {
			enabled: true,
			fallbackOnFailure: config.fallbackOnFailure,
			providers: [
				{
					type: "openai",
					...common,
					apiKey: config.apiKey?.trim() ?? "",
				},
			],
		};
	}
	return {
		enabled: true,
		fallbackOnFailure: config.fallbackOnFailure,
		providers: [
			{
				type: "openai_compatible_remote",
				...common,
				apiKey: config.apiKey?.trim() ?? "",
			},
		],
	};
};

export const createSkillInstallConfig = (
	options: {
		presetId?: InstallPresetId;
		skillProviderDefaults?: SkillProviderDefaultsOptions;
		embeddings?: Partial<EmbeddingsInstallConfig>;
		selectedAreas?: InstallAreaId[];
	} = {},
): SkillsConfig => {
	const config = createDefaultSkillsConfig();
	const selectedAreas =
		options.selectedAreas && options.selectedAreas.length > 0
			? withRequiredCore(options.selectedAreas)
			: resolveInstallAreas(options.presetId);
	if (!selectedAreas.includes("skills")) {
		return config;
	}

	const embeddings = resolveEmbeddingsInstallConfig({
		presetId: options.presetId,
		selectedAreas,
		embeddings: options.embeddings,
	});

	return {
		...config,
		alwaysLoad: ["mimirmesh-agent-router"],
		embeddings:
			embeddings.mode === "docker-llama-cpp" && !options.embeddings
				? {
						enabled: true,
						fallbackOnFailure: embeddings.fallbackOnFailure,
						providers: createSkillProviderDefaults({
							...options.skillProviderDefaults,
							localBaseUrl: embeddings.baseUrl,
							localModel: embeddings.model,
						}),
					}
				: createEmbeddingsSkillConfig(embeddings),
	};
};

const mergeUniqueStrings = (primary: string[], secondary: string[]): string[] => [
	...new Set([...primary, ...secondary]),
];

export const mergeSkillInstallConfig = (
	current: SkillsConfig,
	options: {
		presetId?: InstallPresetId;
		skillProviderDefaults?: SkillProviderDefaultsOptions;
		embeddings?: Partial<EmbeddingsInstallConfig>;
		selectedAreas?: InstallAreaId[];
	} = {},
): SkillsConfig => {
	const selectedAreas =
		options.selectedAreas && options.selectedAreas.length > 0
			? withRequiredCore(options.selectedAreas)
			: resolveInstallAreas(options.presetId);
	if (!selectedAreas.includes("skills") && !options.embeddings) {
		return current;
	}

	const presetConfig = createSkillInstallConfig(options);

	return {
		...current,
		alwaysLoad: mergeUniqueStrings(current.alwaysLoad, presetConfig.alwaysLoad),
		embeddings: options.embeddings
			? presetConfig.embeddings
			: {
					...current.embeddings,
					enabled: current.embeddings.enabled || presetConfig.embeddings.enabled,
					fallbackOnFailure: current.embeddings.fallbackOnFailure,
					providers:
						current.embeddings.providers.length > 0
							? current.embeddings.providers
							: presetConfig.embeddings.providers,
				},
	};
};
