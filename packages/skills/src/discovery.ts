import { buildCacheKey } from "./cache";
import { loadSkillRecords, normalizeSkillText } from "./parser";
import type {
	SkillDescriptor,
	SkillDescriptorInclude,
	SkillRecord,
	SkillsFindRequest,
	SkillsFindResponse,
} from "./types";

const shortDescriptionLimit = 160;

export const deriveShortDescription = (value: string): string => {
	const normalized = normalizeSkillText(value);
	if (normalized.length <= shortDescriptionLimit) {
		return normalized;
	}
	return `${normalized.slice(0, shortDescriptionLimit - 1).trimEnd()}…`;
};

const assetCounts = (record: SkillRecord) => ({
	references: record.assets.filter((asset) => asset.assetType === "reference").length,
	scripts: record.assets.filter((asset) => asset.assetType === "script").length,
	templates: record.assets.filter((asset) => asset.assetType === "template").length,
	examples: record.assets.filter((asset) => asset.assetType === "example").length,
	auxiliaryFiles: record.assets.filter((asset) => asset.assetType === "auxiliary").length,
});

const capabilities = (record: SkillRecord) => ({
	hasReferences: record.assets.some((asset) => asset.assetType === "reference"),
	hasScripts: record.assets.some((asset) => asset.assetType === "script"),
	hasTemplates: record.assets.some((asset) => asset.assetType === "template"),
	hasExamples: record.assets.some((asset) => asset.assetType === "example"),
});

export const projectDescriptor = (
	record: SkillRecord,
	include: SkillDescriptorInclude[] = [],
	matchReason?: string,
): SkillDescriptor => {
	const descriptor: SkillDescriptor = {
		name: record.name,
		shortDescription: deriveShortDescription(record.description),
		cacheKey: buildCacheKey(record.repoId, record.name, record.contentHash),
	};
	if (include.includes("description")) {
		descriptor.description = record.description;
	}
	if (include.includes("contentHash")) {
		descriptor.contentHash = record.contentHash;
	}
	if (include.includes("compatibility")) {
		descriptor.compatibility = record.compatibility ?? null;
	}
	if (include.includes("summary")) {
		descriptor.summary = `${record.description}${record.assets.length > 0 ? ` Assets: ${record.assets.length}.` : ""}`;
	}
	if (include.includes("assetCounts")) {
		descriptor.assetCounts = assetCounts(record);
	}
	if (include.includes("capabilities")) {
		descriptor.capabilities = capabilities(record);
	}
	if (include.includes("matchReason") && matchReason) {
		descriptor.matchReason = matchReason;
	}
	return descriptor;
};

const matchesQuery = (
	record: SkillRecord,
	query: string,
): { matched: boolean; reason?: string; rank: number } => {
	const normalized = query.toLowerCase().trim();
	if (!normalized) {
		return { matched: true, rank: 0 };
	}
	const haystack = `${record.name} ${record.description} ${record.bodyMarkdown}`.toLowerCase();
	if (record.name.toLowerCase() === normalized) {
		return { matched: true, reason: "exactName", rank: 300 };
	}
	if (record.name.toLowerCase().includes(normalized)) {
		return { matched: true, reason: "nameMatch", rank: 250 };
	}
	if (record.description.toLowerCase().includes(normalized)) {
		return { matched: true, reason: "descriptionMatch", rank: 175 };
	}
	if (haystack.includes(normalized)) {
		return { matched: true, reason: "contentMatch", rank: 100 };
	}
	return { matched: false, rank: 0 };
};

export const findSkills = async (
	projectRoot: string,
	request: SkillsFindRequest = {},
	records?: SkillRecord[],
): Promise<SkillsFindResponse> => {
	const loadedRecords = records ?? (await loadSkillRecords(projectRoot));
	const filteredByName =
		request.names && request.names.length > 0
			? loadedRecords.filter((record) => request.names?.includes(record.name))
			: loadedRecords;

	const ranked = filteredByName
		.map((record) => ({
			record,
			queryMatch: request.query ? matchesQuery(record, request.query) : { matched: true, rank: 0 },
		}))
		.filter((entry) => entry.queryMatch.matched)
		.sort((left, right) => {
			if (right.queryMatch.rank !== left.queryMatch.rank) {
				return right.queryMatch.rank - left.queryMatch.rank;
			}
			return left.record.name.localeCompare(right.record.name);
		});

	const offset = request.offset ?? 0;
	const limit = request.limit ?? ranked.length;
	return {
		results: ranked
			.slice(offset, offset + limit)
			.map((entry) => projectDescriptor(entry.record, request.include, entry.queryMatch.reason)),
		total: ranked.length,
	};
};
