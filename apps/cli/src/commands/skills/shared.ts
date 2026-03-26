import { bundledSkillNames, listInstalledBundledSkills } from "@mimirmesh/skills";
import type { PromptChoice } from "@mimirmesh/ui";
import { argument } from "pastel";
import zod from "zod/v4";

export const skillNameArgs = zod
	.array(
		zod
			.string()
			.describe(argument({ name: "skill-name", description: "Optional bundled skill name" })),
	)
	.max(1);

export type SkillCommandAction = "install" | "update" | "remove";
export type SkillRegistryInvocationMode = "maintenance" | "authoring";

type SelectionModel = {
	choices: PromptChoice[];
	defaultValues: string[];
};

const projectRootForSelection = (): string => process.env.MIMIRMESH_PROJECT_ROOT ?? process.cwd();

export const isKnownBundledSkill = (name: string): boolean =>
	bundledSkillNames.includes(name as (typeof bundledSkillNames)[number]);

export const splitCommaList = (value?: string): string[] | undefined =>
	value
		?.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);

export const parseJsonObject = (value?: string): Record<string, unknown> | undefined => {
	if (!value) {
		return undefined;
	}

	const parsed = JSON.parse(value) as unknown;
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error("JSON options must contain an object value.");
	}

	return parsed as Record<string, unknown>;
};

export const parseStringArrayMap = (value?: string): Record<string, string[]> | undefined => {
	if (!value) {
		return undefined;
	}

	const parsed = JSON.parse(value) as unknown;
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error("JSON options must contain an object value.");
	}

	const result: Record<string, string[]> = {};
	for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
		if (!Array.isArray(entry) || entry.some((item) => typeof item !== "string")) {
			throw new Error("JSON options must map each key to an array of strings.");
		}
		result[key] = entry;
	}

	return result;
};

export const buildSkillAuthoringPrompt = (mode: "create" | "update", name?: string): string =>
	mode === "create"
		? "Create a new MímirMesh skill package with deterministic discovery, progressive disclosure, and full-fidelity authoring guidance."
		: `Update the ${name ?? "selected"} skill package with deterministic MímirMesh authoring guidance, preserving full fidelity and validating before and after write.`;

export const resolveSkillUpdateInvocationMode = (
	name?: string,
): { mode: SkillRegistryInvocationMode; skillName?: string } =>
	name && !isKnownBundledSkill(name)
		? { mode: "authoring", skillName: name }
		: { mode: "maintenance", skillName: name };

export const loadSkillSelectionModel = async (
	action: SkillCommandAction,
): Promise<SelectionModel> => {
	const statuses = await listInstalledBundledSkills(projectRootForSelection());

	if (action === "install") {
		return {
			choices: statuses.map((status) => ({
				label: status.name,
				value: status.name,
				description: status.installed
					? `Already installed as ${status.mode ?? "unknown"}; install will refresh it.`
					: status.description,
				recommended: true,
			})),
			defaultValues: statuses.map((status) => status.name),
		};
	}

	if (action === "update") {
		const outdatedInstalled = statuses.filter((status) => status.installed && status.outdated);
		return {
			choices: outdatedInstalled.map((status) => ({
				label: status.name,
				value: status.name,
				description: status.broken
					? "Installed skill is broken and will be repaired."
					: `Installed as ${status.mode ?? "unknown"} and out of date.`,
				recommended: true,
			})),
			defaultValues: outdatedInstalled.map((status) => status.name),
		};
	}

	const installed = statuses.filter((status) => status.installed);
	return {
		choices: installed.map((status) => ({
			label: status.name,
			value: status.name,
			description: `Installed as ${status.mode ?? "unknown"}.`,
		})),
		defaultValues: [],
	};
};
