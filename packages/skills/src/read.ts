import { buildReadSignature } from "./cache";
import { compressText } from "./compression";
import { loadSkillRecords } from "./parser";
import type {
	CompressedSkillMemory,
	SkillAsset,
	SkillReadInclude,
	SkillReadRequest,
	SkillReadResponse,
	SkillRecord,
} from "./types";
import { memoryDerivationVersion } from "./types";

const indexEntriesForType = (record: SkillRecord, assetType: SkillAsset["assetType"]) =>
	record.assets
		.filter((asset) => asset.assetType === assetType)
		.map((asset) => ({
			path: asset.path,
			mediaType: asset.mediaType,
			contentHash: asset.contentHash,
		}));

const bodyEntriesForType = (
	record: SkillRecord,
	assetType: SkillAsset["assetType"],
	selectedPaths?: string[],
) =>
	record.assets
		.filter(
			(asset) =>
				asset.assetType === assetType &&
				(!selectedPaths || selectedPaths.length === 0 || selectedPaths.includes(asset.path)),
		)
		.map((asset) => ({
			path: asset.path,
			mediaType: asset.mediaType,
			textContent: asset.textContent ?? undefined,
		}));

const sectionIndex = (record: SkillRecord) =>
	record.sections.map((section) => ({
		headingPath: section.headingPath,
		sectionHash: section.sectionHash,
	}));

const selectSections = (record: SkillRecord, requested?: string[]) =>
	record.sections
		.filter((section) => {
			if (!requested || requested.length === 0) {
				return true;
			}
			const headingKey = section.headingPath.join(" / ");
			return requested.includes(headingKey) || requested.includes(section.headingPath.at(-1) ?? "");
		})
		.map((section) => ({
			headingPath: section.headingPath,
			text: section.text,
		}));

const collectBullets = (record: SkillRecord, includes: string[]) => {
	const lowered = includes.map((value) => value.toLowerCase());
	return record.sections
		.filter((section) =>
			lowered.some((value) => section.headingPath.join(" ").toLowerCase().includes(value)),
		)
		.flatMap((section) =>
			section.text
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line.startsWith("- ") || line.startsWith("* "))
				.map((line) => line.slice(2).trim()),
		);
};

export const buildCompressedSkillMemory = (record: SkillRecord): CompressedSkillMemory => ({
	name: record.name,
	description: record.description,
	usageTriggers: collectBullets(record, ["trigger", "when"]),
	doFirst: collectBullets(record, ["first", "steps", "start"]),
	avoid: collectBullets(record, ["avoid", "do not"]),
	requiredInputs: collectBullets(record, ["input", "required"]),
	outputs: collectBullets(record, ["output", "result"]),
	decisionRules: collectBullets(record, ["decision", "rules"]),
	compatibility: record.compatibility ?? null,
	contentHash: record.contentHash,
	derivationVersion: memoryDerivationVersion,
});

const defaultIncludeForMode = (mode: SkillReadResponse["mode"]): SkillReadInclude[] => {
	if (mode === "instructions") {
		return ["instructions"];
	}
	if (mode === "assets") {
		return ["referencesIndex", "scriptsIndex", "templatesIndex", "examplesIndex", "auxiliaryIndex"];
	}
	if (mode === "full") {
		return [
			"metadata",
			"instructions",
			"references",
			"scripts",
			"templates",
			"examples",
			"auxiliary",
			"fullText",
		];
	}
	return [];
};

export const readSkillFromRecord = (
	record: SkillRecord,
	request: SkillReadRequest,
): SkillReadResponse => {
	const mode = request.mode ?? "memory";
	const include =
		request.include && request.include.length > 0
			? [...new Set(request.include)]
			: defaultIncludeForMode(mode);
	const readSignature = buildReadSignature({
		...request,
		mode,
		include,
	});
	const memory = buildCompressedSkillMemory(record);
	const compressed = compressText(JSON.stringify(memory), "zstd");
	const response: SkillReadResponse = {
		name: record.name,
		mode,
		contentHash: record.contentHash,
		readSignature,
		compression: {
			representation: mode === "memory" ? "structured-memory" : "none",
			algorithm: mode === "memory" ? compressed.algorithm : "none",
			scope: "transport",
		},
		includedParts: [],
		selected: request.select,
	};

	if (mode === "memory") {
		response.memory = memory;
		response.includedParts.push("memory");
	}
	if (include.includes("metadata")) {
		response.metadata = record.metadata;
		response.includedParts.push("metadata");
	}
	if (include.includes("description")) {
		response.metadata = { ...(response.metadata ?? {}), description: record.description };
		response.includedParts.push("description");
	}
	if (include.includes("instructions") || mode === "instructions" || mode === "full") {
		response.instructions = {
			sections: selectSections(record, request.select?.sections),
		};
		response.includedParts.push("instructions");
	}

	const indexes: NonNullable<SkillReadResponse["indexes"]> = {};
	if (include.includes("sectionIndex")) {
		response.metadata = { ...(response.metadata ?? {}), sectionIndex: sectionIndex(record) };
		response.includedParts.push("sectionIndex");
	}
	if (include.includes("referencesIndex") || mode === "full") {
		indexes.references = indexEntriesForType(record, "reference");
		response.includedParts.push("referencesIndex");
	}
	if (include.includes("scriptsIndex") || mode === "full") {
		indexes.scripts = indexEntriesForType(record, "script");
		response.includedParts.push("scriptsIndex");
	}
	if (include.includes("templatesIndex") || mode === "full") {
		indexes.templates = indexEntriesForType(record, "template");
		response.includedParts.push("templatesIndex");
	}
	if (include.includes("examplesIndex") || mode === "full") {
		indexes.examples = indexEntriesForType(record, "example");
		response.includedParts.push("examplesIndex");
	}
	if (include.includes("auxiliaryIndex") || mode === "full") {
		indexes.auxiliary = indexEntriesForType(record, "auxiliary");
		response.includedParts.push("auxiliaryIndex");
	}
	if (Object.keys(indexes).length > 0) {
		response.indexes = indexes;
	}

	const assets: NonNullable<SkillReadResponse["assets"]> = {};
	if (include.includes("references") || mode === "full") {
		assets.references = bodyEntriesForType(record, "reference", request.select?.references);
		response.includedParts.push("references");
	}
	if (include.includes("scripts") || mode === "full") {
		assets.scripts = bodyEntriesForType(record, "script", request.select?.scripts);
		response.includedParts.push("scripts");
	}
	if (include.includes("templates") || mode === "full") {
		assets.templates = bodyEntriesForType(record, "template", request.select?.templates);
		response.includedParts.push("templates");
	}
	if (include.includes("examples") || mode === "full") {
		assets.examples = bodyEntriesForType(record, "example", request.select?.examples);
		response.includedParts.push("examples");
	}
	if (include.includes("auxiliary") || mode === "full") {
		assets.auxiliary = bodyEntriesForType(record, "auxiliary", request.select?.auxiliary);
		response.includedParts.push("auxiliary");
	}
	if (Object.keys(assets).length > 0) {
		response.assets = assets;
	}

	if (include.includes("fullText") || mode === "full") {
		response.metadata = { ...(response.metadata ?? {}), fullText: record.bodyMarkdown };
		response.includedParts.push("fullText");
	}

	return response;
};

export const readSkill = async (
	projectRoot: string,
	request: SkillReadRequest,
	records?: SkillRecord[],
): Promise<SkillReadResponse> => {
	const loadedRecords = records ?? (await loadSkillRecords(projectRoot));
	const record = loadedRecords.find((entry) => entry.name === request.name);
	if (!record) {
		throw new Error(`Skill not found: ${request.name}`);
	}
	return readSkillFromRecord(record, request);
};
