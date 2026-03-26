import type { MimirmeshConfig } from "@mimirmesh/config";

import { hashValue } from "../state/io";
import { skillRegistryStatePath } from "../state/paths";
import type { SkillRegistryReadinessState, SkillRegistryState } from "../state/skills";

export const classifySkillRegistryReadiness = (
	projectRoot: string,
	config: MimirmeshConfig,
	state: SkillRegistryState | null,
): SkillRegistryReadinessState => {
	const checkedAt = new Date().toISOString();
	const statePath = skillRegistryStatePath(projectRoot);
	const configHash = hashValue(config.skills);

	if (!state) {
		return {
			state: "bootstrapping",
			checkedAt,
			statePath,
			configHash,
			embeddingsEnabled: config.skills.embeddings.enabled,
			providerCount: config.skills.embeddings.providers.length,
			reasons: ["Skill registry state has not been initialized."],
		};
	}

	if (state.configHash !== configHash) {
		return {
			state: "bootstrapping",
			checkedAt,
			statePath,
			configHash,
			embeddingsEnabled: config.skills.embeddings.enabled,
			providerCount: config.skills.embeddings.providers.length,
			reasons: ["Skill registry state is stale for the current repository config."],
		};
	}

	return state.readiness;
};

export const buildSkillRegistryHealthEvidence = (
	projectRoot: string,
	config: MimirmeshConfig,
	state: SkillRegistryState | null,
): {
	state: SkillRegistryReadinessState["state"];
	reasons: string[];
	skillRegistry: SkillRegistryState | null;
} => {
	const readiness = classifySkillRegistryReadiness(projectRoot, config, state);

	return {
		state: readiness.state,
		reasons: readiness.reasons,
		skillRegistry: state,
	};
};
