import { loadSkillRecords } from "./parser";
import type { SkillRecord, SkillsRefreshRequest, SkillsRefreshResponse } from "./types";

export const createRefreshResponse = (options: {
	refreshed: SkillRecord[];
	scope: "repo" | "all";
	invalidatedPositiveCacheEntries: number;
	invalidatedNegativeCacheEntries: number;
	embeddingsReindexed: number;
}): SkillsRefreshResponse => ({
	scope: options.scope,
	refreshedSkills: options.refreshed.map((record) => record.name),
	invalidatedPositiveCacheEntries: options.invalidatedPositiveCacheEntries,
	invalidatedNegativeCacheEntries: options.invalidatedNegativeCacheEntries,
	embeddingsReindexed: options.embeddingsReindexed,
	runtimeReadiness: {
		ready: options.refreshed.length > 0,
		healthClassification: options.refreshed.length > 0 ? "healthy" : "degraded",
		stateArtifactPaths: [],
		message:
			options.refreshed.length > 0
				? `Indexed ${options.refreshed.length} skill(s).`
				: "No skills were indexed during refresh.",
	},
	diagnostics: [],
});

export const refreshSkills = async (
	projectRoot: string,
	request: SkillsRefreshRequest = {},
): Promise<SkillRecord[]> => {
	const records = await loadSkillRecords(projectRoot);
	if (request.names && request.names.length > 0) {
		return records.filter((record) => request.names?.includes(record.name));
	}
	return records;
};
