import type { MimirmeshConfig } from "@mimirmesh/config";
import { resolveSkillProviderSelection } from "../compose/skills-provider";
import { hashValue } from "../state/io";
import { skillRegistryStatePath } from "../state/paths";
import {
	loadSkillRegistryState,
	persistSkillRegistryState,
	type SkillRegistryBootstrapState,
	type SkillRegistryReadinessState,
	type SkillRegistryState,
} from "../state/skills";

const bootstrapState = (options: {
	projectRoot: string;
	config: MimirmeshConfig;
	hostGpuAvailable: boolean;
}): SkillRegistryBootstrapState => {
	const providerSelection = resolveSkillProviderSelection(options.projectRoot, options.config, {
		hostGpuAvailable: options.hostGpuAvailable,
	});
	return {
		state: providerSelection.readiness === "ready" ? "ready" : "degraded",
		checkedAt: new Date().toISOString(),
		hostGpuAvailable: options.hostGpuAvailable,
		reasons: [...providerSelection.reasons],
	};
};

const readinessState = (options: {
	projectRoot: string;
	config: MimirmeshConfig;
	providerSelection: SkillRegistryState["providerSelection"];
}): SkillRegistryReadinessState => ({
	state: options.providerSelection.readiness === "ready" ? "ready" : "degraded",
	checkedAt: new Date().toISOString(),
	statePath: skillRegistryStatePath(options.projectRoot),
	configHash: hashValue(options.config.skills),
	embeddingsEnabled: options.config.skills.embeddings.enabled,
	providerCount: options.providerSelection.providers.length,
	reasons: [...options.providerSelection.reasons],
});

export const createSkillRegistryState = (
	projectRoot: string,
	config: MimirmeshConfig,
	options: { hostGpuAvailable?: boolean } = {},
): SkillRegistryState => {
	const hostGpuAvailable = options.hostGpuAvailable ?? false;
	const providerSelection = resolveSkillProviderSelection(projectRoot, config, {
		hostGpuAvailable,
	});
	const configHash = hashValue(config.skills);
	const bootstrap = bootstrapState({
		projectRoot,
		config,
		hostGpuAvailable,
	});
	const readiness = readinessState({
		projectRoot,
		config,
		providerSelection,
	});

	return {
		projectRoot,
		updatedAt: new Date().toISOString(),
		configHash,
		bootstrap,
		readiness,
		providerSelection,
		skills: [],
		positiveCache: [],
		negativeCache: [],
		embeddings: [],
		lastIndexedAt: null,
	};
};

export const ensureSkillRegistryState = async (
	projectRoot: string,
	config: MimirmeshConfig,
	options: { hostGpuAvailable?: boolean } = {},
): Promise<SkillRegistryState> => {
	const current = await loadSkillRegistryState(projectRoot);
	const next = {
		...createSkillRegistryState(projectRoot, config, options),
		lastIndexedAt: current?.lastIndexedAt ?? null,
	};
	if (
		current &&
		current.configHash === next.configHash &&
		current.bootstrap.hostGpuAvailable === next.bootstrap.hostGpuAvailable &&
		JSON.stringify(current.providerSelection) === JSON.stringify(next.providerSelection)
	) {
		return current;
	}

	await persistSkillRegistryState(projectRoot, next);
	return next;
};
