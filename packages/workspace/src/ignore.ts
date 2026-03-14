import { access, readFile } from "node:fs/promises";
import { isAbsolute, relative } from "node:path";

import ignore, { type Ignore } from "ignore";

const repositoryIgnoreFiles = [".gitignore", ".ignore", ".mimirmeshignore"] as const;
const builtinIgnoreRules = [".git/"] as const;

const normalizePath = (value: string): string => value.replaceAll("\\", "/");

const trimRelativePrefix = (value: string): string =>
	value.replace(/^\.\/+/, "").replace(/^\/+/, "");

const readIgnoreFile = async (path: string): Promise<string> => {
	try {
		await access(path);
		return await readFile(path, "utf8");
	} catch {
		return "";
	}
};

export type RepositoryIgnoreMatcher = {
	rootPath: string;
	sources: string[];
	toRelativePath: (candidatePath: string) => string | null;
	ignores: (candidatePath: string, options?: { isDirectory?: boolean }) => boolean;
};

export const loadRepositoryIgnoreMatcher = async (
	rootPath: string,
): Promise<RepositoryIgnoreMatcher> => {
	const matcher: Ignore = ignore();
	matcher.add([...builtinIgnoreRules]);

	const sources: string[] = [];
	for (const fileName of repositoryIgnoreFiles) {
		const contents = await readIgnoreFile(`${rootPath}/${fileName}`);
		if (!contents.trim()) {
			continue;
		}

		matcher.add(contents);
		sources.push(fileName);
	}

	const toRelativePath = (candidatePath: string): string | null => {
		if (!candidatePath.trim()) {
			return null;
		}

		const normalized = normalizePath(candidatePath.trim());
		if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
			return null;
		}
		if (normalized.startsWith("file://")) {
			return null;
		}

		if (isAbsolute(normalized)) {
			const relativePath = normalizePath(relative(rootPath, normalized));
			if (relativePath.startsWith("../") || relativePath === "..") {
				return null;
			}
			return trimRelativePrefix(relativePath);
		}

		return trimRelativePrefix(normalized);
	};

	const ignores = (candidatePath: string, options: { isDirectory?: boolean } = {}): boolean => {
		const relativePath = toRelativePath(candidatePath);
		if (!relativePath) {
			return false;
		}

		const subject = options.isDirectory ? `${relativePath.replace(/\/+$/, "")}/` : relativePath;
		return matcher.ignores(subject);
	};

	return {
		rootPath,
		sources,
		toRelativePath,
		ignores,
	};
};
