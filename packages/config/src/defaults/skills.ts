import type { SkillsConfig } from "../schema";

const defaultSkillResolvePrecedence: SkillsConfig["resolve"]["precedence"] = [
	"alwaysLoad",
	"explicitName",
	"aliasOrTrigger",
	"lexical",
	"embeddings",
	"mcpEngineContext",
];

export const createDefaultSkillsConfig = (): SkillsConfig => ({
	alwaysLoad: [],
	resolve: {
		precedence: [...defaultSkillResolvePrecedence],
		limit: 10,
	},
	read: {
		defaultMode: "memory",
		progressiveDisclosure: "strict",
	},
	cache: {
		negativeCache: {
			enabled: true,
			ttlSeconds: 900,
		},
	},
	compression: {
		enabled: true,
		algorithm: "zstd",
		fallbackAlgorithm: "gzip",
		profile: "strict",
	},
	embeddings: {
		enabled: false,
		fallbackOnFailure: true,
		providers: [],
	},
});
