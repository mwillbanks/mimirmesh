import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

const packageRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));

const requiredPrimarySkillNames = [
	"mimirmesh-agent-router",
	"mimirmesh-code-navigation",
	"mimirmesh-code-investigation",
	"mimirmesh-speckit-delivery",
	"mimirmesh-architecture-delivery",
	"mimirmesh-integration-analysis",
] as const;

const supportingSkillNames = ["mimirmesh-operational-policies"] as const;

const reservedDirectories = new Set(["src", "tests", "node_modules"]);
const validSkillName = /^(?!-)(?!.*--)[a-z0-9-]{1,64}(?<!-)$/;
const relativeLinkPattern = /\[[^\]]+\]\(([^)]+)\)/g;

export type BundledSkillName =
	| (typeof requiredPrimarySkillNames)[number]
	| (typeof supportingSkillNames)[number];

export type SkillFrontmatter = {
	name: string;
	description: string;
	license?: string;
	compatibility?: string;
	metadata?: Record<string, string>;
	"allowed-tools"?: string;
};

export type BundledSkill = {
	name: string;
	description: string;
	license?: string;
	compatibility?: string;
	metadata: Record<string, string>;
	allowedTools?: string[];
	body: string;
	directory: string;
	skillPath: string;
};

export type SkillValidationIssue = {
	skill: string;
	message: string;
};

const splitSkillDocument = (document: string): { frontmatter: string; body: string } => {
	const match = document.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!match) {
		throw new Error("SKILL.md must start with YAML frontmatter delimited by --- lines.");
	}

	return {
		frontmatter: match[1] ?? "",
		body: match[2] ?? "",
	};
};

const toAllowedTools = (value: string | undefined): string[] | undefined => {
	if (!value) {
		return undefined;
	}

	const tools = value
		.split(/\s+/)
		.map((entry) => entry.trim())
		.filter(Boolean);

	return tools.length > 0 ? tools : undefined;
};

const parseSkillFrontmatter = (source: string): SkillFrontmatter => {
	const parsed = YAML.parse(source);
	if (typeof parsed !== "object" || parsed === null) {
		throw new Error("SKILL.md frontmatter must parse to a mapping.");
	}

	return parsed as SkillFrontmatter;
};

const validateMetadata = (
	metadata: unknown,
	skillName: string,
	issues: SkillValidationIssue[],
): Record<string, string> => {
	if (metadata == null) {
		return {};
	}
	if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
		issues.push({
			skill: skillName,
			message: "`metadata` must be a mapping of string keys to string values.",
		});
		return {};
	}

	const normalized: Record<string, string> = {};
	for (const [key, value] of Object.entries(metadata)) {
		if (typeof value !== "string") {
			issues.push({
				skill: skillName,
				message: `metadata.${key} must be a string value.`,
			});
			continue;
		}
		normalized[key] = value;
	}

	return normalized;
};

const resolveSkillRelativeLink = (skillDirectory: string, linkTarget: string): string => {
	const withoutAnchor = linkTarget.split("#")[0] ?? linkTarget;
	return resolve(skillDirectory, withoutAnchor);
};

const validateRelativeLinks = async (
	body: string,
	skillDirectory: string,
	skillName: string,
	issues: SkillValidationIssue[],
): Promise<void> => {
	const links = [...body.matchAll(relativeLinkPattern)]
		.map((match) => match[1]?.trim() ?? "")
		.filter(Boolean)
		.filter(
			(target) =>
				!target.startsWith("http://") &&
				!target.startsWith("https://") &&
				!target.startsWith("mailto:") &&
				!target.startsWith("#"),
		);

	for (const target of links) {
		if (target.includes("../")) {
			issues.push({
				skill: skillName,
				message: `Relative link \`${target}\` escapes the skill root. Keep linked resources inside the skill directory.`,
			});
			continue;
		}

		const absoluteTarget = resolveSkillRelativeLink(skillDirectory, target);
		if (!absoluteTarget.startsWith(skillDirectory)) {
			issues.push({
				skill: skillName,
				message: `Relative link \`${target}\` resolves outside the skill root.`,
			});
			continue;
		}

		try {
			await stat(absoluteTarget);
		} catch {
			issues.push({
				skill: skillName,
				message: `Relative link \`${target}\` does not resolve to an existing file.`,
			});
		}
	}
};

const validateSkillFrontmatter = (
	frontmatter: SkillFrontmatter,
	directoryName: string,
	issues: SkillValidationIssue[],
): Record<string, string> => {
	const metadata = validateMetadata(frontmatter.metadata, directoryName, issues);

	if (typeof frontmatter.name !== "string" || frontmatter.name.length === 0) {
		issues.push({ skill: directoryName, message: "`name` is required." });
	} else {
		if (!validSkillName.test(frontmatter.name)) {
			issues.push({
				skill: directoryName,
				message:
					"`name` must be 1-64 characters, lowercase alphanumeric or hyphen, and may not start, end, or double hyphen.",
			});
		}
		if (frontmatter.name !== directoryName) {
			issues.push({
				skill: directoryName,
				message: "`name` must exactly match the parent directory name.",
			});
		}
		if (!frontmatter.name.startsWith("mimirmesh-")) {
			issues.push({
				skill: directoryName,
				message: "All bundled skill names must be prefixed with `mimirmesh-`.",
			});
		}
	}

	if (typeof frontmatter.description !== "string" || frontmatter.description.trim().length === 0) {
		issues.push({ skill: directoryName, message: "`description` is required." });
	} else if (frontmatter.description.length > 1024) {
		issues.push({
			skill: directoryName,
			message: "`description` must be 1024 characters or fewer.",
		});
	}

	if (
		frontmatter.compatibility !== undefined &&
		(typeof frontmatter.compatibility !== "string" || frontmatter.compatibility.length > 500)
	) {
		issues.push({
			skill: directoryName,
			message: "`compatibility` must be a string of 500 characters or fewer.",
		});
	}

	if (
		frontmatter.license !== undefined &&
		(typeof frontmatter.license !== "string" || frontmatter.license.trim().length === 0)
	) {
		issues.push({
			skill: directoryName,
			message: "`license` must be a non-empty string when provided.",
		});
	}

	if (
		frontmatter["allowed-tools"] !== undefined &&
		typeof frontmatter["allowed-tools"] !== "string"
	) {
		issues.push({
			skill: directoryName,
			message: "`allowed-tools` must be a space-delimited string when provided.",
		});
	}

	return metadata;
};

export const bundledSkillNames = [...requiredPrimarySkillNames, ...supportingSkillNames] as const;

const skillSortOrder = new Map(bundledSkillNames.map((name, index) => [name, index]));

export const getSkillsPackageRoot = (): string => packageRoot;

export const listBundledSkillDirectories = async (
	root: string = packageRoot,
): Promise<string[]> => {
	const entries = await readdir(root, { withFileTypes: true });

	const candidates = entries
		.filter((entry) => entry.isDirectory() && !reservedDirectories.has(entry.name))
		.map((entry) => join(root, entry.name));

	const skillDirectories: string[] = [];
	for (const candidate of candidates) {
		try {
			await stat(join(candidate, "SKILL.md"));
			skillDirectories.push(candidate);
		} catch {}
	}

	return skillDirectories.sort((left, right) => {
		const leftName = relative(root, left) || left;
		const rightName = relative(root, right) || right;
		return (
			(skillSortOrder.get(leftName as BundledSkillName) ?? Number.MAX_SAFE_INTEGER) -
			(skillSortOrder.get(rightName as BundledSkillName) ?? Number.MAX_SAFE_INTEGER)
		);
	});
};

export const readBundledSkill = async (skillDirectory: string): Promise<BundledSkill> => {
	const skillPath = join(skillDirectory, "SKILL.md");
	const raw = await readFile(skillPath, "utf8");
	const { frontmatter: frontmatterSource, body } = splitSkillDocument(raw);
	const frontmatter = parseSkillFrontmatter(frontmatterSource);
	const metadata =
		typeof frontmatter.metadata === "object" && frontmatter.metadata !== null
			? (frontmatter.metadata as Record<string, string>)
			: {};

	return {
		name: frontmatter.name,
		description: frontmatter.description,
		license: frontmatter.license,
		compatibility: frontmatter.compatibility,
		metadata,
		allowedTools: toAllowedTools(frontmatter["allowed-tools"]),
		body,
		directory: skillDirectory,
		skillPath,
	};
};

export const createBundledSkillCatalog = async (
	root: string = packageRoot,
): Promise<BundledSkill[]> => {
	const directories = await listBundledSkillDirectories(root);
	return Promise.all(directories.map((directory) => readBundledSkill(directory)));
};

export const validateBundledSkills = async (
	root: string = packageRoot,
): Promise<SkillValidationIssue[]> => {
	const directories = await listBundledSkillDirectories(root);
	const issues: SkillValidationIssue[] = [];
	const discoveredNames = new Set<string>();

	for (const directory of directories) {
		const directoryName = relative(root, directory) || directory;
		const raw = await readFile(join(directory, "SKILL.md"), "utf8");
		const { frontmatter: frontmatterSource, body } = splitSkillDocument(raw);
		const frontmatter = parseSkillFrontmatter(frontmatterSource);
		validateSkillFrontmatter(frontmatter, directoryName, issues);

		if (frontmatter.name) {
			if (discoveredNames.has(frontmatter.name)) {
				issues.push({
					skill: directoryName,
					message: `Duplicate skill name \`${frontmatter.name}\` detected.`,
				});
			}
			discoveredNames.add(frontmatter.name);
		}

		if (body.split("\n").length > 500) {
			issues.push({
				skill: directoryName,
				message: "SKILL.md should stay under 500 lines; move detailed content into references/.",
			});
		}

		if (body.includes("MM_SKILL_")) {
			issues.push({
				skill: directoryName,
				message: "SKILL.md still references obsolete draft MM_SKILL files.",
			});
		}

		await validateRelativeLinks(body, directory, directoryName, issues);
	}

	for (const requiredSkillName of bundledSkillNames) {
		if (!discoveredNames.has(requiredSkillName)) {
			issues.push({
				skill: requiredSkillName,
				message: "Required bundled skill is missing.",
			});
		}
	}

	return issues;
};

export const writeBundledSkillAssets = async (
	targetDirectory: string,
	root: string = packageRoot,
): Promise<void> => {
	const skills = await createBundledSkillCatalog(root);

	await rm(targetDirectory, { recursive: true, force: true });
	await mkdir(targetDirectory, { recursive: true });

	for (const skill of skills) {
		await cp(skill.directory, join(targetDirectory, skill.name), { recursive: true });
	}

	await writeFile(
		join(targetDirectory, "catalog.json"),
		`${JSON.stringify(
			{
				skills: skills.map((skill) => ({
					name: skill.name,
					description: skill.description,
					license: skill.license,
					compatibility: skill.compatibility,
					metadata: skill.metadata,
					allowedTools: skill.allowedTools ?? [],
					path: skill.name,
				})),
			},
			null,
			2,
		)}\n`,
		"utf8",
	);
};

export const bundledSkillManifestDirectory = (targetRoot: string): string =>
	join(dirname(targetRoot), "skills");
