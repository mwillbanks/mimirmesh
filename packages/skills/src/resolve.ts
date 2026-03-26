import { projectDescriptor } from "./discovery";
import type { SkillEmbeddingProvider } from "./embeddings";
import { loadSkillRecords } from "./parser";
import type { SkillRecord, SkillsResolveRequest, SkillsResolveResponse } from "./types";

export type SkillResolvePolicy = {
	alwaysLoad?: string[];
	resolve?: {
		precedence?: string[];
		limit?: number;
	};
	embeddings?: {
		enabled?: boolean;
		providers?: SkillEmbeddingProvider[];
	};
};

export type ResolveSkillsFromRecordsOptions = {
	embeddingMatches?: Array<{
		name: string;
		score: number;
		reason?: string;
	}>;
};

const defaultPrecedence = [
	"alwaysLoad",
	"explicitName",
	"aliasOrTrigger",
	"lexical",
	"embeddings",
	"mcpEngineContext",
];

const tokenize = (value: string): string[] =>
	value
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);

const aliasValues = (record: SkillRecord): string[] => {
	const aliases = record.metadata.aliases;
	if (Array.isArray(aliases)) {
		return aliases.filter((value): value is string => typeof value === "string");
	}
	if (typeof aliases === "string") {
		return aliases
			.split(",")
			.map((value) => value.trim())
			.filter(Boolean);
	}
	return [];
};

const triggerValues = (record: SkillRecord): string[] => {
	const triggers = record.metadata.triggers;
	if (Array.isArray(triggers)) {
		return triggers.filter((value): value is string => typeof value === "string");
	}
	if (typeof triggers === "string") {
		return triggers
			.split(",")
			.map((value) => value.trim())
			.filter(Boolean);
	}
	return [];
};

const lexicalScore = (record: SkillRecord, terms: string[]): number => {
	const haystack = `${record.name} ${record.description} ${record.bodyMarkdown}`.toLowerCase();
	return terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
};

const mcpEngineScore = (
	record: SkillRecord,
	context: Record<string, unknown> | undefined,
): number => {
	if (!context) {
		return 0;
	}
	const serialized = JSON.stringify(context).toLowerCase();
	if (serialized.includes(record.name.toLowerCase())) {
		return 3;
	}
	if (serialized.includes(record.description.toLowerCase())) {
		return 2;
	}
	return 0;
};

export const resolveSkillsFromRecords = async (
	records: SkillRecord[],
	request: SkillsResolveRequest,
	policy: SkillResolvePolicy = {},
	options: ResolveSkillsFromRecordsOptions = {},
): Promise<SkillsResolveResponse> => {
	const precedenceApplied = policy.resolve?.precedence?.length
		? policy.resolve.precedence
		: defaultPrecedence;
	const limit = request.limit ?? policy.resolve?.limit ?? 10;
	const terms = tokenize(request.prompt);
	const selected = new Map<
		string,
		{ record: SkillRecord; score: number; reason: string; configInfluence: string[] }
	>();

	const applyCandidate = (
		record: SkillRecord,
		score: number,
		reason: string,
		configInfluence: string[] = [],
	): void => {
		const existing = selected.get(record.name);
		if (
			!existing ||
			score > existing.score ||
			(score === existing.score && reason < existing.reason)
		) {
			selected.set(record.name, { record, score, reason, configInfluence });
		}
	};

	for (const stage of precedenceApplied) {
		if (stage === "alwaysLoad") {
			for (const name of policy.alwaysLoad ?? []) {
				const record = records.find((entry) => entry.name === name);
				if (record) {
					applyCandidate(record, 1_000, "alwaysLoad", ["alwaysLoad"]);
				}
			}
			continue;
		}
		if (stage === "explicitName") {
			for (const record of records) {
				if (request.prompt.toLowerCase().includes(record.name.toLowerCase())) {
					applyCandidate(record, 900, "explicitName");
				}
			}
			continue;
		}
		if (stage === "aliasOrTrigger") {
			for (const record of records) {
				const aliases = [...aliasValues(record), ...triggerValues(record)];
				if (aliases.some((alias) => request.prompt.toLowerCase().includes(alias.toLowerCase()))) {
					applyCandidate(record, 800, "aliasOrTrigger");
				}
			}
			continue;
		}
		if (stage === "lexical") {
			for (const record of records) {
				const score = lexicalScore(record, terms);
				if (score > 0) {
					applyCandidate(record, 500 + score, "lexical");
				}
			}
			continue;
		}
		if (stage === "embeddings") {
			for (const match of options.embeddingMatches ?? []) {
				const record = records.find((entry) => entry.name === match.name);
				if (!record) {
					continue;
				}
				applyCandidate(record, 300 + match.score, match.reason ?? "embeddings", ["embeddings"]);
			}
			continue;
		}
		if (stage === "mcpEngineContext" && request.mcpEngineContext) {
			for (const record of records) {
				const score = mcpEngineScore(record, request.mcpEngineContext);
				if (score > 0) {
					applyCandidate(record, 100 + score, "mcpEngineContext", ["mcpEngineContext"]);
				}
			}
		}
	}

	const include = request.include ?? [];
	const results = [...selected.values()]
		.sort(
			(left, right) =>
				right.score - left.score || left.record.name.localeCompare(right.record.name),
		)
		.slice(0, limit)
		.map((entry) => {
			const descriptor = projectDescriptor(entry.record, ["matchReason"]);
			const result: SkillsResolveResponse["results"][number] = {
				...descriptor,
			};
			if (include.includes("matchReason")) {
				result.matchReason = entry.reason;
			}
			if (include.includes("score")) {
				result.score = entry.score;
			}
			if (include.includes("configInfluence")) {
				result.configInfluence = entry.configInfluence;
			}
			if (include.includes("readHint")) {
				result.readHint = {
					mode: "memory",
					include: ["referencesIndex"],
				};
			}
			return result;
		});

	return {
		results,
		precedenceApplied,
		usedMcpEngineContext: Boolean(request.mcpEngineContext),
		total: results.length,
	};
};

export const resolveSkills = async (
	projectRoot: string,
	request: SkillsResolveRequest,
	policy: SkillResolvePolicy = {},
	records?: SkillRecord[],
	options: ResolveSkillsFromRecordsOptions = {},
): Promise<SkillsResolveResponse> =>
	resolveSkillsFromRecords(
		records ?? (await loadSkillRecords(projectRoot)),
		request,
		policy,
		options,
	);
