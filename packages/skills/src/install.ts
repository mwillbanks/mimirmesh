import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
	cp,
	lstat,
	mkdir,
	readdir,
	readFile,
	realpath,
	rm,
	stat,
	symlink,
	writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { bundledSkillNames, createBundledSkillCatalog } from "./catalog";
import type { AgentsManagedSectionOutcome } from "./types";

export type SkillInstallMode = "symlink" | "copy";

export type InstalledBundledSkill = {
	name: string;
	description: string;
	sourcePath: string;
	targetPath: string;
	installed: boolean;
	mode: SkillInstallMode | null;
	outdated: boolean;
	broken: boolean;
};

export type SkillInstallResult = {
	mode: SkillInstallMode;
	installed: string[];
	skipped: string[];
};

export type SkillUpdateResult = {
	mode: SkillInstallMode;
	updated: string[];
	skipped: string[];
	missing: string[];
};

export type ManagedAgentsSectionResult = {
	outcome: AgentsManagedSectionOutcome;
	path: string;
	contentHash: string;
};

export const managedAgentsSectionBegin = "<!-- BEGIN MIMIRMESH SKILLS SECTION -->";
export const managedAgentsSectionEnd = "<!-- END MIMIRMESH SKILLS SECTION -->";

const managedAgentsSectionBody = `## MimirMesh Skill Workflows

- Use \`skills.find\` before loading local skill content broadly.
- Use \`skills.read\` with default \`memory\` mode and targeted selections before broader reads.
- Use \`skills.resolve\` and \`skills.refresh\` for deterministic repository-aware skill selection and cache refresh.
- Use \`skills.create\` and \`skills.update\` for guided skill authoring and maintenance.
- Do not treat this \`AGENTS.md\` section as a runtime ranking source; runtime resolution comes from the MimirMesh skill subsystem and \`.mimirmesh/config.yml\`.
`;

const bundledSkillsRootFromSource = resolve(fileURLToPath(new URL("../", import.meta.url)));
const sourceCheckoutRoot = resolve(bundledSkillsRootFromSource, "..", "..");

export type BundledSkillsRootResolutionOptions = {
	overrideDir?: string;
	execPath?: string;
	cwd?: string;
	sourceRoot?: string;
	sourceCheckoutRoot?: string;
};

const skillAssetCandidates = (options: BundledSkillsRootResolutionOptions = {}): string[] => {
	const execDir = dirname(options.execPath ?? process.execPath);
	const cwd = options.cwd ?? process.cwd();
	const overrideDir = options.overrideDir ?? process.env.MIMIRMESH_SKILLS_ASSETS_DIR;
	const sourceRoot = options.sourceRoot ?? bundledSkillsRootFromSource;
	const checkoutRoot = options.sourceCheckoutRoot ?? sourceCheckoutRoot;

	const candidates = [
		overrideDir ? resolve(overrideDir) : null,
		join(execDir, "mimirmesh-assets", "skills"),
		join(execDir, ".mimirmesh-assets", "skills"),
		join(cwd, "dist", "mimirmesh-assets", "skills"),
		sourceRoot,
		join(checkoutRoot, "packages", "skills"),
		join(cwd, "packages", "skills"),
	];

	return [...new Set(candidates.filter((candidate): candidate is string => Boolean(candidate)))];
};

const isValidBundledSkillsRoot = (root: string): boolean => {
	if (existsSync(join(root, "catalog.json"))) {
		return true;
	}

	return bundledSkillNames.every((name) => existsSync(join(root, name, "SKILL.md")));
};

export const resolveBundledSkillsRoot = (
	options: BundledSkillsRootResolutionOptions = {},
): string => {
	for (const candidate of skillAssetCandidates(options)) {
		if (isValidBundledSkillsRoot(candidate)) {
			return candidate;
		}
	}

	throw new Error(
		[
			"Unable to locate bundled MímirMesh skills.",
			"Checked:",
			...skillAssetCandidates(options).map((candidate) => `- ${candidate}`),
			"Expected a bundled skills root containing catalog.json or the bundled skill directories.",
		].join("\n"),
	);
};

export const bundledSkillsInstallDir = (projectRoot: string): string =>
	join(projectRoot, ".agents", "skills");

const listFilesRecursively = async (root: string, relativeRoot = ""): Promise<string[]> => {
	const absoluteRoot = join(root, relativeRoot);
	const entries = await readdir(absoluteRoot, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const relativePath = join(relativeRoot, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await listFilesRecursively(root, relativePath)));
			continue;
		}

		files.push(relativePath.replaceAll("\\", "/"));
	}

	return files.sort((left, right) => left.localeCompare(right));
};

const directoryHash = async (root: string): Promise<string> => {
	const hash = createHash("sha256");
	const files = await listFilesRecursively(root);

	for (const file of files) {
		hash.update(file);
		hash.update(await readFile(join(root, file)));
	}

	return hash.digest("hex");
};

const agentsSectionHash = (content: string): string =>
	createHash("sha256").update(content).digest("hex");

const validateSkillNames = (names: string[]): void => {
	const unknown = names.filter(
		(name) => !bundledSkillNames.includes(name as (typeof bundledSkillNames)[number]),
	);
	if (unknown.length > 0) {
		throw new Error(`Unknown bundled skill(s): ${unknown.join(", ")}`);
	}
};

export const listInstalledBundledSkills = async (
	projectRoot: string,
	root = resolveBundledSkillsRoot(),
): Promise<InstalledBundledSkill[]> => {
	const catalog = await createBundledSkillCatalog(root);
	const targetRoot = bundledSkillsInstallDir(projectRoot);

	return Promise.all(
		catalog.map(async (skill) => {
			const targetPath = join(targetRoot, skill.name);
			const sourcePath = join(root, skill.name);

			try {
				const targetStats = await lstat(targetPath);

				if (targetStats.isSymbolicLink()) {
					try {
						const [sourceRealPath, targetRealPath] = await Promise.all([
							realpath(sourcePath),
							realpath(targetPath),
						]);
						return {
							name: skill.name,
							description: skill.description,
							sourcePath,
							targetPath,
							installed: true,
							mode: "symlink",
							outdated: sourceRealPath !== targetRealPath,
							broken: false,
						} satisfies InstalledBundledSkill;
					} catch {
						return {
							name: skill.name,
							description: skill.description,
							sourcePath,
							targetPath,
							installed: true,
							mode: "symlink",
							outdated: true,
							broken: true,
						} satisfies InstalledBundledSkill;
					}
				}

				if (targetStats.isDirectory()) {
					const [sourceDigest, targetDigest] = await Promise.all([
						directoryHash(sourcePath),
						directoryHash(targetPath),
					]);

					return {
						name: skill.name,
						description: skill.description,
						sourcePath,
						targetPath,
						installed: true,
						mode: "copy",
						outdated: sourceDigest !== targetDigest,
						broken: false,
					} satisfies InstalledBundledSkill;
				}

				return {
					name: skill.name,
					description: skill.description,
					sourcePath,
					targetPath,
					installed: true,
					mode: null,
					outdated: true,
					broken: true,
				} satisfies InstalledBundledSkill;
			} catch {
				return {
					name: skill.name,
					description: skill.description,
					sourcePath,
					targetPath,
					installed: false,
					mode: null,
					outdated: false,
					broken: false,
				} satisfies InstalledBundledSkill;
			}
		}),
	);
};

const installModeType = (): "dir" | "junction" =>
	process.platform === "win32" ? "junction" : "dir";

const installSkill = async (
	sourcePath: string,
	targetPath: string,
	mode: SkillInstallMode,
): Promise<void> => {
	await rm(targetPath, { recursive: true, force: true });

	if (mode === "symlink") {
		await symlink(sourcePath, targetPath, installModeType());
		return;
	}

	await cp(sourcePath, targetPath, { recursive: true });
};

export const installBundledSkills = async (options: {
	projectRoot: string;
	names: string[];
	mode: SkillInstallMode;
	root?: string;
}): Promise<SkillInstallResult> => {
	validateSkillNames(options.names);

	const root = options.root ?? resolveBundledSkillsRoot();
	const targetRoot = bundledSkillsInstallDir(options.projectRoot);
	await mkdir(targetRoot, { recursive: true });

	const installed: string[] = [];
	for (const name of options.names) {
		const sourcePath = join(root, name);
		await stat(sourcePath);
		await installSkill(sourcePath, join(targetRoot, name), options.mode);
		installed.push(name);
	}

	return {
		mode: options.mode,
		installed,
		skipped: [],
	};
};

export const updateBundledSkills = async (options: {
	projectRoot: string;
	names?: string[];
	mode: SkillInstallMode;
	root?: string;
}): Promise<SkillUpdateResult> => {
	const root = options.root ?? resolveBundledSkillsRoot();
	if (options.names) {
		validateSkillNames(options.names);
	}

	const statuses = await listInstalledBundledSkills(options.projectRoot, root);
	const selected = options.names
		? statuses.filter((status) => options.names?.includes(status.name))
		: statuses.filter((status) => status.installed && status.outdated);

	const updated: string[] = [];
	const skipped: string[] = [];
	const missing: string[] = [];

	for (const status of selected) {
		if (!status.installed) {
			missing.push(status.name);
			continue;
		}

		if (!status.outdated) {
			skipped.push(status.name);
			continue;
		}

		await installSkill(status.sourcePath, status.targetPath, options.mode);
		updated.push(status.name);
	}

	return {
		mode: options.mode,
		updated,
		skipped,
		missing,
	};
};

export const removeBundledSkills = async (options: {
	projectRoot: string;
	names: string[];
}): Promise<{ removed: string[]; skipped: string[] }> => {
	validateSkillNames(options.names);

	const targetRoot = bundledSkillsInstallDir(options.projectRoot);
	const removed: string[] = [];
	const skipped: string[] = [];

	for (const name of options.names) {
		const targetPath = join(targetRoot, name);
		try {
			await rm(targetPath, { recursive: true, force: false });
			removed.push(name);
		} catch {
			skipped.push(name);
		}
	}

	return { removed, skipped };
};

const renderManagedAgentsSection = (): string =>
	`${managedAgentsSectionBegin}\n${managedAgentsSectionBody.trim()}\n${managedAgentsSectionEnd}`;

export const ensureManagedAgentsSection = async (
	projectRoot: string,
): Promise<ManagedAgentsSectionResult> => {
	const path = join(projectRoot, "AGENTS.md");
	const rendered = renderManagedAgentsSection();
	const renderedHash = agentsSectionHash(rendered);

	try {
		const existing = await readFile(path, "utf8");
		if (
			existing.includes(managedAgentsSectionBegin) &&
			existing.includes(managedAgentsSectionEnd)
		) {
			const pattern = new RegExp(
				`${managedAgentsSectionBegin}[\\s\\S]*?${managedAgentsSectionEnd}`,
				"m",
			);
			const next = existing.replace(pattern, rendered);
			if (next === existing) {
				return {
					outcome: "no-op",
					path,
					contentHash: renderedHash,
				};
			}
			await writeFile(path, next, "utf8");
			return {
				outcome: "updated",
				path,
				contentHash: renderedHash,
			};
		}

		const next = `${existing.trimEnd()}\n\n${rendered}\n`;
		await writeFile(path, next, "utf8");
		return {
			outcome: "inserted",
			path,
			contentHash: renderedHash,
		};
	} catch {
		await writeFile(path, `${rendered}\n`, "utf8");
		return {
			outcome: "created",
			path,
			contentHash: renderedHash,
		};
	}
};
