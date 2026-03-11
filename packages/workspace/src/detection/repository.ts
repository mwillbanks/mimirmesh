import { access, lstat, readdir, readFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";

import { detectSpecKit } from "../speckit/manager";
import type { SpecKitStatus } from "../speckit/types";

export type RepositoryShape = "single-package" | "monorepo" | "docs-heavy" | "mixed";

export type RepositoryAnalysis = {
	rootPath: string;
	shape: RepositoryShape;
	languages: string[];
	frameworks: string[];
	packageManagers: string[];
	keyDirectories: string[];
	entrypoints: string[];
	docsFiles: string[];
	ciFiles: string[];
	iacFiles: string[];
	dockerFiles: string[];
	specKit: SpecKitStatus;
	fileCount: number;
};

export type SearchHit = {
	filePath: string;
	line: number;
	preview: string;
	score: number;
};

const ignoredDirectories = new Set([
	".git",
	"node_modules",
	"dist",
	"build",
	"coverage",
	"tmp",
	".next",
	".turbo",
	".cache",
	"vendor",
]);

const docsExtensions = new Set([".md", ".mdx", ".txt", ".rst", ".adoc", ".html"]);
const codeExtensions = new Set([
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".cjs",
	".go",
	".py",
	".rs",
	".java",
	".kt",
	".swift",
	".c",
	".cpp",
	".cs",
	".php",
]);

const languageByExtension = new Map<string, string>([
	[".ts", "TypeScript"],
	[".tsx", "TypeScript"],
	[".js", "JavaScript"],
	[".jsx", "JavaScript"],
	[".mjs", "JavaScript"],
	[".cjs", "JavaScript"],
	[".go", "Go"],
	[".py", "Python"],
	[".rs", "Rust"],
	[".java", "Java"],
	[".kt", "Kotlin"],
	[".swift", "Swift"],
	[".c", "C"],
	[".cpp", "C++"],
	[".cs", "C#"],
	[".php", "PHP"],
	[".rb", "Ruby"],
	[".sh", "Shell"],
]);

const frameworkIndicators: Array<{ name: string; dependency: string }> = [
	{ name: "React", dependency: "react" },
	{ name: "Next.js", dependency: "next" },
	{ name: "Vue", dependency: "vue" },
	{ name: "Svelte", dependency: "svelte" },
	{ name: "Express", dependency: "express" },
	{ name: "Fastify", dependency: "fastify" },
	{ name: "NestJS", dependency: "@nestjs/core" },
	{ name: "Bun", dependency: "bun" },
	{ name: "Hono", dependency: "hono" },
	{ name: "MCP SDK", dependency: "@modelcontextprotocol/sdk" },
];

const iacNameMatchers = [
	/\.tf$/,
	/\.tfvars$/,
	/cloudformation/i,
	/\.bicep$/,
	/pulumi\./i,
	/kustomization\.ya?ml$/,
	/helm/i,
];

const ciMatchers = [/\.github\/workflows\//, /\.gitlab-ci\.yml$/, /Jenkinsfile$/];

const dockerMatchers = [/Dockerfile/i, /docker-compose\.ya?ml$/, /compose\.ya?ml$/];

const normalizePath = (path: string): string => path.split("\\").join("/");

const isTextFile = (path: string): boolean => {
	const extension = extname(path).toLowerCase();
	return docsExtensions.has(extension) || codeExtensions.has(extension) || extension === ".json";
};

const readTextSafe = async (path: string): Promise<string> => {
	try {
		const content = await readFile(path, "utf8");
		if (content.includes("\u0000")) {
			return "";
		}
		return content;
	} catch {
		return "";
	}
};

export const pathExists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

export const collectRepositoryFiles = async (
	rootPath: string,
	options: { maxFiles?: number } = {},
): Promise<string[]> => {
	const output: string[] = [];
	const maxFiles = options.maxFiles ?? 20000;

	const walk = async (dirPath: string): Promise<void> => {
		if (output.length >= maxFiles) {
			return;
		}

		const entries = await readdir(dirPath, { withFileTypes: true });
		for (const entry of entries) {
			if (output.length >= maxFiles) {
				break;
			}

			if (entry.name.startsWith(".") && entry.name !== ".mimirmesh" && entry.name !== ".github") {
				if (entry.name !== ".vscode" && entry.name !== ".cursor" && entry.name !== ".claude") {
					continue;
				}
			}

			if (ignoredDirectories.has(entry.name)) {
				continue;
			}

			const absolutePath = join(dirPath, entry.name);
			if (entry.isDirectory()) {
				await walk(absolutePath);
				continue;
			}
			if (entry.isFile()) {
				output.push(absolutePath);
			}
		}
	};

	await walk(rootPath);
	return output;
};

const detectPackageManagers = async (rootPath: string): Promise<string[]> => {
	const managers = new Set<string>();
	if (await pathExists(join(rootPath, "bun.lock"))) {
		managers.add("bun");
	}
	if (await pathExists(join(rootPath, "pnpm-lock.yaml"))) {
		managers.add("pnpm");
	}
	if (await pathExists(join(rootPath, "package-lock.json"))) {
		managers.add("npm");
	}
	if (await pathExists(join(rootPath, "yarn.lock"))) {
		managers.add("yarn");
	}
	if (await pathExists(join(rootPath, "Cargo.lock"))) {
		managers.add("cargo");
	}
	if (await pathExists(join(rootPath, "go.sum"))) {
		managers.add("go");
	}
	return [...managers];
};

const detectFrameworks = async (rootPath: string): Promise<string[]> => {
	const packageJsonPath = join(rootPath, "package.json");
	if (!(await pathExists(packageJsonPath))) {
		return [];
	}

	const raw = await readTextSafe(packageJsonPath);
	if (!raw) {
		return [];
	}
	try {
		const packageJson = JSON.parse(raw) as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
		};
		const dependencyNames = new Set([
			...Object.keys(packageJson.dependencies ?? {}),
			...Object.keys(packageJson.devDependencies ?? {}),
		]);
		const frameworks = frameworkIndicators
			.filter((indicator) => dependencyNames.has(indicator.dependency))
			.map((indicator) => indicator.name);
		return frameworks;
	} catch {
		return [];
	}
};

const detectEntrypoints = (relativeFiles: string[]): string[] => {
	const candidates = [
		"src/main.ts",
		"src/index.ts",
		"main.ts",
		"index.ts",
		"apps/cli/src/cli.ts",
		"Dockerfile",
		"docker-compose.yml",
	];
	return candidates.filter((candidate) => relativeFiles.includes(candidate));
};

const detectRepoShape = (relativeFiles: string[], docsFiles: string[]): RepositoryShape => {
	const hasWorkspace =
		relativeFiles.includes("pnpm-workspace.yaml") || relativeFiles.includes("bun.lockb");
	const hasAppsDir = relativeFiles.some((file) => file.startsWith("apps/"));
	const hasPackagesDir = relativeFiles.some((file) => file.startsWith("packages/"));

	if (hasWorkspace || (hasAppsDir && hasPackagesDir)) {
		return "monorepo";
	}
	if (docsFiles.length > 0 && docsFiles.length > Math.max(10, relativeFiles.length / 2)) {
		return "docs-heavy";
	}
	if (relativeFiles.some((file) => file.startsWith("src/"))) {
		return "single-package";
	}
	return "mixed";
};

const scoreLine = (line: string, query: string): number => {
	const normalized = line.toLowerCase();
	const normalizedQuery = query.toLowerCase();
	if (!normalized.includes(normalizedQuery)) {
		return 0;
	}
	const exactOccurrences = normalized.split(normalizedQuery).length - 1;
	const proximityBonus = Math.max(0, 80 - line.length);
	return exactOccurrences * 10 + proximityBonus;
};

export const analyzeRepository = async (rootPath: string): Promise<RepositoryAnalysis> => {
	const files = await collectRepositoryFiles(rootPath);
	const relativeFiles = files.map((path) => normalizePath(relative(rootPath, path)));

	const languages = new Set<string>();
	const keyDirectories = new Set<string>();
	const docsFiles: string[] = [];
	const ciFiles: string[] = [];
	const iacFiles: string[] = [];
	const dockerFiles: string[] = [];

	for (const relativePath of relativeFiles) {
		const extension = extname(relativePath).toLowerCase();
		const language = languageByExtension.get(extension);
		if (language) {
			languages.add(language);
		}

		const topDir = relativePath.split("/")[0];
		if (topDir && topDir !== ".") {
			keyDirectories.add(topDir);
		}

		if (docsExtensions.has(extension) || relativePath.includes("docs/")) {
			docsFiles.push(relativePath);
		}
		if (ciMatchers.some((matcher) => matcher.test(relativePath))) {
			ciFiles.push(relativePath);
		}
		if (iacNameMatchers.some((matcher) => matcher.test(relativePath))) {
			iacFiles.push(relativePath);
		}
		if (dockerMatchers.some((matcher) => matcher.test(relativePath))) {
			dockerFiles.push(relativePath);
		}
	}

	const frameworks = await detectFrameworks(rootPath);
	const packageManagers = await detectPackageManagers(rootPath);
	const entrypoints = detectEntrypoints(relativeFiles);
	const shape = detectRepoShape(relativeFiles, docsFiles);
	const specKit = await detectSpecKit(rootPath);

	return {
		rootPath,
		shape,
		languages: [...languages].sort(),
		frameworks: frameworks.sort(),
		packageManagers: packageManagers.sort(),
		keyDirectories: [...keyDirectories].sort(),
		entrypoints,
		docsFiles: docsFiles.sort(),
		ciFiles: ciFiles.sort(),
		iacFiles: iacFiles.sort(),
		dockerFiles: dockerFiles.sort(),
		specKit,
		fileCount: relativeFiles.length,
	};
};

export const detectRepoType = async (rootPath: string): Promise<RepositoryShape> => {
	const analysis = await analyzeRepository(rootPath);
	return analysis.shape;
};

export const searchInRepository = async (
	rootPath: string,
	query: string,
	options: { docsOnly?: boolean; maxHits?: number } = {},
): Promise<SearchHit[]> => {
	const maxHits = options.maxHits ?? 25;
	const files = await collectRepositoryFiles(rootPath);
	const hits: SearchHit[] = [];

	for (const file of files) {
		const rel = normalizePath(relative(rootPath, file));
		const extension = extname(file).toLowerCase();
		if (options.docsOnly && !docsExtensions.has(extension) && !rel.includes("docs/")) {
			continue;
		}
		if (!isTextFile(file)) {
			continue;
		}

		const content = await readTextSafe(file);
		if (!content) {
			continue;
		}
		const lines = content.split(/\r?\n/);
		for (let index = 0; index < lines.length; index += 1) {
			const line = lines[index] ?? "";
			const score = scoreLine(line, query);
			if (score === 0) {
				continue;
			}
			hits.push({
				filePath: rel,
				line: index + 1,
				preview: line.trim().slice(0, 200),
				score,
			});
			if (hits.length >= maxHits * 4) {
				break;
			}
		}
		if (hits.length >= maxHits * 4) {
			break;
		}
	}

	return hits.sort((a, b) => b.score - a.score).slice(0, maxHits);
};

export const findSymbols = async (
	rootPath: string,
	symbolQuery: string,
	maxHits = 20,
): Promise<SearchHit[]> => {
	const files = await collectRepositoryFiles(rootPath);
	const symbolRegex = new RegExp(
		`(?:function|class|interface|type|const|let|var|enum)\\s+${symbolQuery.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}`,
		"i",
	);
	const hits: SearchHit[] = [];

	for (const file of files) {
		const rel = normalizePath(relative(rootPath, file));
		if (!codeExtensions.has(extname(file).toLowerCase())) {
			continue;
		}

		const content = await readTextSafe(file);
		if (!content) {
			continue;
		}
		const lines = content.split(/\r?\n/);
		for (let i = 0; i < lines.length; i += 1) {
			const line = lines[i] ?? "";
			if (!symbolRegex.test(line)) {
				continue;
			}
			hits.push({
				filePath: rel,
				line: i + 1,
				preview: line.trim().slice(0, 240),
				score: 100 - Math.min(90, i),
			});
			break;
		}
		if (hits.length >= maxHits) {
			break;
		}
	}

	return hits.slice(0, maxHits);
};

export type DependencyTrace = {
	target: string;
	dependents: string[];
};

export const traceDependency = async (
	rootPath: string,
	target: string,
	maxDependents = 40,
): Promise<DependencyTrace> => {
	const files = await collectRepositoryFiles(rootPath);
	const dependents: string[] = [];
	const escapedTarget = target.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
	const importRegex = new RegExp(`(?:from|require\\()\\s*['"]${escapedTarget}`, "i");

	for (const file of files) {
		if (!codeExtensions.has(extname(file).toLowerCase())) {
			continue;
		}
		const content = await readTextSafe(file);
		if (!content) {
			continue;
		}
		if (importRegex.test(content)) {
			dependents.push(normalizePath(relative(rootPath, file)));
		}
		if (dependents.length >= maxDependents) {
			break;
		}
	}

	return {
		target,
		dependents,
	};
};

export const createMountPlan = (analysis: RepositoryAnalysis): Record<string, string> => {
	const projectRoot = analysis.rootPath;
	return {
		repository: projectRoot,
		mimirmesh: join(projectRoot, ".mimirmesh"),
		templates: join(projectRoot, ".mimirmesh", "templates"),
		logs: join(projectRoot, ".mimirmesh", "logs"),
		indexes: join(projectRoot, ".mimirmesh", "indexes"),
	};
};

export const getRepositoryName = (rootPath: string): string => basename(rootPath);

export const isInsideGitRepo = async (rootPath: string): Promise<boolean> => {
	const gitDir = join(rootPath, ".git");
	try {
		const stats = await lstat(gitDir);
		return stats.isDirectory() || stats.isFile();
	} catch {
		return false;
	}
};
