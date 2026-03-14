import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["apps", "packages"];
const testExtensions = [".test.ts", ".test.tsx"];

const isTestFile = (filePath: string): boolean =>
	testExtensions.some((ext) => filePath.endsWith(ext));

const hasSrcSegment = (filePath: string): boolean => filePath.includes(`${path.sep}src${path.sep}`);

const shouldSkip = (filePath: string): boolean => filePath.includes(`${path.sep}tests${path.sep}`);

const collectTestFiles = async (dir: string): Promise<string[]> => {
	const collected: string[] = [];
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const entryPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				collected.push(...(await collectTestFiles(entryPath)));
			} else if (entry.isFile() && isTestFile(entryPath) && hasSrcSegment(entryPath)) {
				collected.push(entryPath);
			}
		}
	} catch {
		// ignore missing directories
	}
	return collected;
};

const normalizePosix = (value: string): string => value.replace(/\\/g, "/");

const updateImportPaths = (content: string, oldFile: string, newDir: string): string => {
	const importRegex = /(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g;
	return content.replace(importRegex, (match, prefix, importPath, suffix) => {
		if (!importPath.startsWith(".")) {
			return match;
		}

		const moduleAbsolute = path.resolve(path.dirname(oldFile), importPath);
		if (!moduleAbsolute.includes(`${path.sep}src${path.sep}`)) {
			return match;
		}

		const relativePath = path.relative(newDir, moduleAbsolute) || "./";
		const normalized = normalizePosix(relativePath).startsWith(".")
			? normalizePosix(relativePath)
			: `./${normalizePosix(relativePath)}`;
		return `${prefix}${normalized}${suffix}`;
	});
};

const moveTestFile = async (filePath: string): Promise<void> => {
	if (shouldSkip(filePath)) {
		return;
	}

	const relative = path.relative(root, filePath);
	const newRelative = relative.replace(`${path.sep}src${path.sep}`, `${path.sep}tests${path.sep}`);
	const newPath = path.join(root, newRelative);
	const newDir = path.dirname(newPath);

	await fs.mkdir(newDir, { recursive: true });
	const content = await fs.readFile(filePath, "utf8");
	const transformed = updateImportPaths(content, filePath, newDir);
	await fs.writeFile(newPath, transformed, "utf8");
	await fs.unlink(filePath);
};

const main = async () => {
	const tasks: Promise<void>[] = [];
	for (const source of sourceRoots) {
		const absoluteSource = path.join(root, source);
		const testFiles = await collectTestFiles(absoluteSource);
		for (const file of testFiles) {
			tasks.push(moveTestFile(file));
		}
	}
	await Promise.all(tasks);
};

main().catch((error) => {
	console.error("Failed to move tests to tests/ directories:", error);
	process.exit(1);
});
