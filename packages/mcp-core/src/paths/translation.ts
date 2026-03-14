import { isAbsolute, relative } from "node:path";

import type { EngineId, MimirmeshConfig } from "@mimirmesh/config";

const CONTAINER_ABSOLUTE_FIELDS = new Set([
	"projectPath",
	"filePath",
	"adrPath",
	"todoPath",
	"outputPath",
	"repo_path",
	"rootPath",
]);

const REPO_RELATIVE_FIELDS = new Set(["adrDirectory", "outputDirectory"]);
const REPO_RELATIVE_ARRAY_FIELDS = new Set(["watchFolders"]);
const STRUCTURED_PATH_FIELDS = new Set([
	...CONTAINER_ABSOLUTE_FIELDS,
	...REPO_RELATIVE_FIELDS,
	...REPO_RELATIVE_ARRAY_FIELDS,
	"path",
]);

const normalizeSlashes = (value: string): string => value.replaceAll("\\", "/");

const normalizeRelativePath = (value: string): string =>
	normalizeSlashes(value.trim())
		.replace(/^\.\/+/, "")
		.replace(/^\/+/, "");

const toRepoRelativePath = (projectRoot: string, candidatePath: string): string | null => {
	const normalized = normalizeSlashes(candidatePath.trim());
	if (!normalized) {
		return null;
	}
	if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
		return null;
	}

	if (!isAbsolute(normalized)) {
		return normalizeRelativePath(normalized);
	}

	const relativePath = normalizeSlashes(relative(projectRoot, normalized));
	if (relativePath === ".." || relativePath.startsWith("../")) {
		return null;
	}
	return normalizeRelativePath(relativePath);
};

const toContainerPath = (
	projectRoot: string,
	repoMount: string,
	mimirmeshMount: string,
	value: string,
): string => {
	const trimmed = value.trim();
	if (!trimmed) {
		return trimmed;
	}

	const normalized = normalizeSlashes(trimmed);
	if (normalized.startsWith(repoMount) || normalized.startsWith(mimirmeshMount)) {
		return normalized;
	}

	const mimirmeshRoot = `${normalizeSlashes(projectRoot)}/.mimirmesh`;
	if (isAbsolute(normalized)) {
		if (normalized === mimirmeshRoot || normalized.startsWith(`${mimirmeshRoot}/`)) {
			const suffix = normalized.slice(mimirmeshRoot.length).replace(/^\/+/, "");
			return suffix ? `${mimirmeshMount}/${suffix}` : mimirmeshMount;
		}

		if (
			normalized === normalizeSlashes(projectRoot) ||
			normalized.startsWith(`${normalizeSlashes(projectRoot)}/`)
		) {
			const suffix = normalized.slice(normalizeSlashes(projectRoot).length).replace(/^\/+/, "");
			return suffix ? `${repoMount}/${suffix}` : repoMount;
		}

		return normalized;
	}

	const relativePath = normalizeRelativePath(normalized);
	return relativePath ? `${repoMount}/${relativePath}` : repoMount;
};

const toDisplayPath = (
	projectRoot: string,
	repoMount: string,
	mimirmeshMount: string,
	value: string,
): string => {
	const normalized = normalizeSlashes(value);
	if (normalized === repoMount || normalized.startsWith(`${repoMount}/`)) {
		const suffix = normalized.slice(repoMount.length).replace(/^\/+/, "");
		return suffix ? `${normalizeSlashes(projectRoot)}/${suffix}` : normalizeSlashes(projectRoot);
	}

	if (normalized === mimirmeshMount || normalized.startsWith(`${mimirmeshMount}/`)) {
		const suffix = normalized.slice(mimirmeshMount.length).replace(/^\/+/, "");
		const root = `${normalizeSlashes(projectRoot)}/.mimirmesh`;
		return suffix ? `${root}/${suffix}` : root;
	}

	return value;
};

const engineMounts = (config: MimirmeshConfig, engine: EngineId) => config.engines[engine].mounts;

const translateValue = (
	field: string,
	value: unknown,
	projectRoot: string,
	config: MimirmeshConfig,
	engine: EngineId,
): unknown => {
	const mounts = engineMounts(config, engine);

	if (typeof value === "string") {
		if (CONTAINER_ABSOLUTE_FIELDS.has(field)) {
			return toContainerPath(projectRoot, mounts.repo, mounts.mimirmesh, value);
		}
		if (REPO_RELATIVE_FIELDS.has(field)) {
			const relativePath =
				toRepoRelativePath(projectRoot, value) ??
				(value.startsWith(mounts.repo)
					? normalizeRelativePath(value.slice(mounts.repo.length))
					: value.startsWith(mounts.mimirmesh)
						? `.mimirmesh/${normalizeRelativePath(value.slice(mounts.mimirmesh.length))}`
						: normalizeRelativePath(value));
			return relativePath;
		}
		return value;
	}

	if (Array.isArray(value) && REPO_RELATIVE_ARRAY_FIELDS.has(field)) {
		return value.map((entry) =>
			typeof entry === "string"
				? (toRepoRelativePath(projectRoot, entry) ??
					(entry.startsWith(mounts.repo)
						? normalizeRelativePath(entry.slice(mounts.repo.length))
						: normalizeRelativePath(entry)))
				: entry,
		);
	}

	return value;
};

export const translateEngineToolInput = (
	input: Record<string, unknown>,
	options: {
		projectRoot: string;
		config: MimirmeshConfig;
		engine: EngineId;
	},
): Record<string, unknown> =>
	Object.fromEntries(
		Object.entries(input).map(([field, value]) => [
			field,
			translateValue(field, value, options.projectRoot, options.config, options.engine),
		]),
	);

const normalizePayloadValue = (
	key: string,
	value: unknown,
	projectRoot: string,
	config: MimirmeshConfig,
	engine: EngineId,
): unknown => {
	const mounts = engineMounts(config, engine);

	if (typeof value === "string" && STRUCTURED_PATH_FIELDS.has(key)) {
		return toDisplayPath(projectRoot, mounts.repo, mounts.mimirmesh, value);
	}

	if (Array.isArray(value)) {
		return value.map((entry) => normalizePayloadValue(key, entry, projectRoot, config, engine));
	}

	if (typeof value === "object" && value !== null) {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
				entryKey,
				normalizePayloadValue(entryKey, entryValue, projectRoot, config, engine),
			]),
		);
	}

	return value;
};

export const normalizeEnginePayloadPaths = (
	payload: unknown,
	options: {
		projectRoot: string;
		config: MimirmeshConfig;
		engine: EngineId;
	},
): unknown =>
	normalizePayloadValue("", payload, options.projectRoot, options.config, options.engine);
