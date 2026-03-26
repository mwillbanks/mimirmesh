import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";

import YAML from "yaml";

import { buildRepoId, createUuid, hashDeterministic } from "./cache";
import { splitSkillDocument } from "./catalog";
import { resolveBundledSkillsRoot } from "./install";
import {
	type SkillAsset,
	type SkillAssetType,
	type SkillRecord,
	type SkillSection,
	type SkillSectionKind,
	type SkillSourceProvider,
	skillSchemaVersion,
} from "./types";

type ParsedFrontmatter = {
	name?: string;
	description?: string;
	license?: string;
	compatibility?: string | null;
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
};

const reservedSkillDirectories = new Set(["node_modules", ".git", ".DS_Store"]);

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const textTokenEstimate = (value: string): number => {
	const tokens = normalizeWhitespace(value).split(" ").filter(Boolean).length;
	return Math.max(1, Math.ceil(tokens * 1.2));
};

const parseFrontmatter = (source: string): ParsedFrontmatter => {
	if (!source.trim()) {
		return {};
	}
	return (YAML.parse(source) ?? {}) as ParsedFrontmatter;
};

const nowIso = (): string => new Date().toISOString();

const inferAssetType = (path: string): SkillAssetType => {
	if (path.startsWith("references/")) {
		return "reference";
	}
	if (path.startsWith("scripts/")) {
		return "script";
	}
	if (path.startsWith("templates/")) {
		return "template";
	}
	if (path.startsWith("examples/")) {
		return "example";
	}
	return "auxiliary";
};

const inferMediaType = (path: string): string | null => {
	if (path.endsWith(".md")) {
		return "text/markdown";
	}
	if (path.endsWith(".ts")) {
		return "text/typescript";
	}
	if (path.endsWith(".tsx")) {
		return "text/tsx";
	}
	if (path.endsWith(".js")) {
		return "text/javascript";
	}
	if (path.endsWith(".json")) {
		return "application/json";
	}
	if (path.endsWith(".yaml") || path.endsWith(".yml")) {
		return "application/yaml";
	}
	if (path.endsWith(".sh")) {
		return "application/x-sh";
	}
	return null;
};

const readTextAsset = async (absolutePath: string): Promise<string | null> => {
	try {
		return await readFile(absolutePath, "utf8");
	} catch {
		return null;
	}
};

const collectFiles = async (root: string, relativeRoot = ""): Promise<string[]> => {
	const absoluteRoot = join(root, relativeRoot);
	const entries = await readdir(absoluteRoot, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		if (reservedSkillDirectories.has(entry.name)) {
			continue;
		}
		const nextRelative = relativeRoot ? join(relativeRoot, entry.name) : entry.name;
		if (entry.isDirectory()) {
			files.push(...(await collectFiles(root, nextRelative)));
			continue;
		}
		if (entry.name === "SKILL.md") {
			continue;
		}
		files.push(nextRelative.replaceAll("\\", "/"));
	}

	return files.sort((left, right) => left.localeCompare(right));
};

const buildSectionKind = (headingPath: string[]): SkillSectionKind => {
	const last = headingPath.at(-1)?.toLowerCase() ?? "";
	if (last.includes("example")) {
		return "example";
	}
	if (last.includes("reference")) {
		return "reference_hint";
	}
	if (last.includes("compat")) {
		return "compatibility";
	}
	if (headingPath.length > 0) {
		return "instructions";
	}
	return "other";
};

const firstParagraph = (body: string): string => {
	for (const paragraph of body.split(/\n\s*\n/)) {
		const normalized = normalizeWhitespace(paragraph.replace(/^#+\s+/gm, ""));
		if (normalized) {
			return normalized;
		}
	}
	return "";
};

const parseSections = (skillId: string, body: string): SkillSection[] => {
	const lines = body.split("\n");
	const sections: SkillSection[] = [];
	const headingPath: string[] = [];
	let currentLevel = 0;
	let currentHeadingPath: string[] = [];
	let buffer: string[] = [];

	const flush = () => {
		const text = normalizeWhitespace(buffer.join("\n"));
		if (!text) {
			buffer = [];
			return;
		}
		const ordinal = sections.length;
		sections.push({
			id: createUuid(),
			skillId,
			ordinal,
			kind: buildSectionKind(currentHeadingPath),
			headingPath: [...currentHeadingPath],
			text,
			tokenEstimate: textTokenEstimate(text),
			sectionHash: hashDeterministic({
				headingPath: currentHeadingPath,
				text,
			}),
		});
		buffer = [];
	};

	for (const line of lines) {
		const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
		if (!headingMatch) {
			buffer.push(line);
			continue;
		}

		flush();
		const level = headingMatch[1]?.length ?? 0;
		const title = normalizeWhitespace(headingMatch[2] ?? "");
		if (!title) {
			continue;
		}
		while (headingPath.length >= level) {
			headingPath.pop();
		}
		headingPath.push(title);
		currentLevel = level;
		currentHeadingPath = headingPath.slice(0, currentLevel);
	}

	flush();
	return sections;
};

const buildAssets = async (skillId: string, skillDirectory: string): Promise<SkillAsset[]> => {
	const files = await collectFiles(skillDirectory);
	return Promise.all(
		files.map(async (path) => {
			const absolutePath = join(skillDirectory, path);
			const textContent = await readTextAsset(absolutePath);
			const contentBuffer = textContent ?? (await readFile(absolutePath)).toString("base64");
			return {
				id: createUuid(),
				skillId,
				path,
				assetType: inferAssetType(path),
				mediaType: inferMediaType(path),
				textContent,
				blobRef: textContent ? null : absolutePath,
				compression: null,
				contentHash: hashDeterministic({
					path,
					content: contentBuffer,
				}),
				tokenEstimate: textTokenEstimate(textContent ?? contentBuffer),
			} satisfies SkillAsset;
		}),
	);
};

const parseSkillRecord = async (
	projectRoot: string,
	skillDirectory: string,
	provider: SkillSourceProvider,
	sourceRoot: string,
): Promise<SkillRecord> => {
	const skillPath = join(skillDirectory, "SKILL.md");
	const rawMarkdown = await readFile(skillPath, "utf8");
	const { frontmatter, body } = splitSkillDocument(rawMarkdown);
	const parsed = parseFrontmatter(frontmatter);
	const repoId = buildRepoId(projectRoot);
	const discoveredAt = nowIso();
	const skillId = createUuid();
	const metadata =
		parsed.metadata && typeof parsed.metadata === "object"
			? (parsed.metadata as Record<string, unknown>)
			: {};
	const assets = await buildAssets(skillId, skillDirectory);
	const sections = parseSections(skillId, body);
	const name = normalizeWhitespace(parsed.name ?? basename(skillDirectory));
	const description = normalizeWhitespace(parsed.description ?? firstParagraph(body));
	const contentHash = hashDeterministic({
		name,
		description,
		license: parsed.license ?? null,
		compatibility: parsed.compatibility ?? null,
		metadata,
		body,
		assets: assets.map((asset) => ({
			path: asset.path,
			contentHash: asset.contentHash,
		})),
	});

	return {
		id: skillId,
		repoId,
		name,
		description,
		license: typeof parsed.license === "string" ? parsed.license : undefined,
		compatibility:
			typeof parsed.compatibility === "string"
				? parsed.compatibility
				: (parsed.compatibility ?? null),
		metadata,
		source: {
			rootPath: sourceRoot,
			skillPath,
			provider,
			revision: null,
		},
		rawMarkdown,
		frontmatterSource: frontmatter,
		bodyMarkdown: body,
		contentHash,
		schemaVersion: skillSchemaVersion,
		parseWarnings: description
			? []
			: ["Description could not be derived from frontmatter or body."],
		rawCompression: null,
		normalizedCompression: null,
		discoveredAt,
		indexedAt: discoveredAt,
		updatedAt: discoveredAt,
		sections,
		assets,
	};
};

const findRepoSkillDirectories = async (projectRoot: string): Promise<string[]> => {
	const skillsRoot = join(projectRoot, ".agents", "skills");
	try {
		const entries = await readdir(skillsRoot, { withFileTypes: true });
		const directories = entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => join(skillsRoot, entry.name));
		const validated: string[] = [];
		for (const directory of directories) {
			try {
				await stat(join(directory, "SKILL.md"));
				validated.push(directory);
			} catch {
				// ignored
			}
		}
		return validated.sort((left, right) => left.localeCompare(right));
	} catch {
		return [];
	}
};

const findBundledSkillDirectories = async (): Promise<string[]> => {
	try {
		const bundledRoot = resolveBundledSkillsRoot();
		const entries = await readdir(bundledRoot, { withFileTypes: true });
		const directories = entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => join(bundledRoot, entry.name));
		const validated: string[] = [];
		for (const directory of directories) {
			try {
				await stat(join(directory, "SKILL.md"));
				validated.push(directory);
			} catch {
				// ignored
			}
		}
		return validated.sort((left, right) => left.localeCompare(right));
	} catch {
		return [];
	}
};

export const loadSkillRecords = async (projectRoot: string): Promise<SkillRecord[]> => {
	const [repoDirectories, bundledDirectories] = await Promise.all([
		findRepoSkillDirectories(projectRoot),
		findBundledSkillDirectories(),
	]);
	const records = await Promise.all([
		...repoDirectories.map((directory) =>
			parseSkillRecord(
				projectRoot,
				directory,
				"repository",
				join(projectRoot, ".agents", "skills"),
			),
		),
		...bundledDirectories.map((directory) =>
			parseSkillRecord(projectRoot, directory, "bundled", resolveBundledSkillsRoot()),
		),
	]);
	const byName = new Map<string, SkillRecord>();
	for (const record of records.sort((left, right) => left.name.localeCompare(right.name))) {
		const existing = byName.get(record.name);
		if (
			!existing ||
			(existing.source.provider === "bundled" && record.source.provider === "repository")
		) {
			byName.set(record.name, record);
		}
	}
	return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
};

export const normalizeSkillText = normalizeWhitespace;
export const deriveSkillDescription = firstParagraph;
