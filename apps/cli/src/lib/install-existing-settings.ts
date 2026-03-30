import { join } from "node:path";
import type { MimirmeshConfig } from "@mimirmesh/config";
import {
	defaultDockerLlamaCppBaseUrl,
	defaultDockerLlamaCppModel,
	defaultLmStudioBaseUrl,
	defaultLmStudioModel,
	defaultOpenAIBaseUrl,
	defaultOpenAIModel,
	type EmbeddingsInstallConfig,
	type InstallAreaId,
	type InstallationStateSnapshot,
	type InstallPresetId,
	type InstallTarget,
	installTargetCatalog,
} from "@mimirmesh/installer";
import { bundledSkillNames, type InstalledBundledSkill } from "@mimirmesh/skills";

export type ExistingInstallSettings = {
	hasExistingState: boolean;
	presetId: InstallPresetId;
	selectedAreas: InstallAreaId[];
	ideTargets: InstallTarget[];
	selectedSkills: string[];
	embeddings: EmbeddingsInstallConfig;
};

const ideConfigPath = (projectRoot: string, target: InstallTarget): string => {
	if (target === "vscode") {
		return join(projectRoot, ".vscode", "mcp.json");
	}
	if (target === "cursor") {
		return join(projectRoot, ".cursor", "mcp.json");
	}
	if (target === "claude") {
		return join(projectRoot, ".claude", "mcp.json");
	}
	return join(projectRoot, ".codex", "mcp.json");
};

const inferEmbeddingsInstallConfig = (config: MimirmeshConfig): EmbeddingsInstallConfig => {
	if (!config.skills.embeddings.enabled || config.skills.embeddings.providers.length === 0) {
		return {
			mode: "disabled",
			fallbackOnFailure: config.skills.embeddings.fallbackOnFailure,
		};
	}

	const [provider] = config.skills.embeddings.providers;
	if (!provider) {
		return {
			mode: "disabled",
			fallbackOnFailure: config.skills.embeddings.fallbackOnFailure,
		};
	}

	if (provider.type === "llama_cpp") {
		return {
			mode: "docker-llama-cpp",
			model: provider.model || defaultDockerLlamaCppModel,
			baseUrl: provider.baseUrl || defaultDockerLlamaCppBaseUrl,
			fallbackOnFailure: config.skills.embeddings.fallbackOnFailure,
		};
	}

	if (provider.type === "lm_studio") {
		return {
			mode: "existing-lm-studio",
			model: provider.model || defaultLmStudioModel,
			baseUrl: provider.baseUrl || defaultLmStudioBaseUrl,
			apiKey: provider.apiKey?.trim() || undefined,
			fallbackOnFailure: config.skills.embeddings.fallbackOnFailure,
		};
	}

	if (provider.type === "openai") {
		return {
			mode: "openai",
			model: provider.model || defaultOpenAIModel,
			baseUrl: provider.baseUrl || defaultOpenAIBaseUrl,
			apiKey: provider.apiKey?.trim() || undefined,
			fallbackOnFailure: config.skills.embeddings.fallbackOnFailure,
		};
	}

	return {
		mode: "existing-openai-compatible",
		model: provider.model || "",
		baseUrl: provider.baseUrl || "",
		apiKey: provider.apiKey?.trim() || undefined,
		fallbackOnFailure: config.skills.embeddings.fallbackOnFailure,
	};
};

const inferPresetId = (selectedAreas: InstallAreaId[]): InstallPresetId => {
	const includesIde = selectedAreas.includes("ide");
	const includesSkills = selectedAreas.includes("skills");
	if (includesIde && includesSkills) {
		return "full";
	}
	if (includesSkills) {
		return "recommended";
	}
	return "minimal";
};

export const inferExistingInstallSettings = (options: {
	projectRoot: string;
	config: MimirmeshConfig;
	snapshot: InstallationStateSnapshot;
	skillStatuses: InstalledBundledSkill[];
}): ExistingInstallSettings => {
	const ideTargets = installTargetCatalog.filter((target) =>
		options.snapshot.detectedArtifacts.some(
			(artifact) =>
				artifact.areaId === "ide" &&
				artifact.path === ideConfigPath(options.projectRoot, target) &&
				artifact.status !== "missing",
		),
	);
	const installedSkillNames = options.skillStatuses
		.filter((status) => status.installed || status.outdated || status.broken)
		.map((status) => status.name);
	const embeddings = inferEmbeddingsInstallConfig(options.config);

	const selectedAreas: InstallAreaId[] = ["core"];
	if (
		ideTargets.length > 0 ||
		options.snapshot.completedAreas.includes("ide") ||
		options.snapshot.degradedAreas.includes("ide")
	) {
		selectedAreas.push("ide");
	}
	if (
		installedSkillNames.length > 0 ||
		options.config.skills.embeddings.enabled ||
		options.snapshot.completedAreas.includes("skills") ||
		options.snapshot.degradedAreas.includes("skills")
	) {
		selectedAreas.push("skills");
	}

	const hasExistingState =
		options.snapshot.completedAreas.length > 0 ||
		options.snapshot.degradedAreas.length > 0 ||
		ideTargets.length > 0 ||
		installedSkillNames.length > 0 ||
		options.config.skills.embeddings.enabled;

	return {
		hasExistingState,
		presetId: inferPresetId(selectedAreas),
		selectedAreas,
		ideTargets,
		selectedSkills:
			selectedAreas.includes("skills") && installedSkillNames.length === 0
				? [...bundledSkillNames]
				: installedSkillNames,
		embeddings,
	};
};
