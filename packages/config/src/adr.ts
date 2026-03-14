import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const adrDirectoryCandidates = [
	"docs/adr",
	"docs/decisions",
	"docs/adrs",
	"adr",
	"decisions",
	"adrs",
] as const;

const directoryHasAdrFiles = (directory: string): boolean => {
	if (!existsSync(directory)) {
		return false;
	}

	return readdirSync(directory).some((entry) => entry.endsWith(".md") || entry.endsWith(".mdx"));
};

export const resolveRepositoryAdrDirectory = (
	projectRoot: string,
	configuredPath = "docs/adr",
): string => {
	if (
		configuredPath &&
		!adrDirectoryCandidates.includes(configuredPath as (typeof adrDirectoryCandidates)[number])
	) {
		return configuredPath;
	}

	for (const candidate of adrDirectoryCandidates) {
		if (directoryHasAdrFiles(join(projectRoot, candidate))) {
			return candidate;
		}
	}

	for (const candidate of adrDirectoryCandidates) {
		if (existsSync(join(projectRoot, candidate))) {
			return candidate;
		}
	}

	return configuredPath || "docs/adr";
};
