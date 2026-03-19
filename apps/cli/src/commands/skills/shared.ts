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

type SelectionModel = {
	choices: PromptChoice[];
	defaultValues: string[];
};

const projectRootForSelection = (): string => process.env.MIMIRMESH_PROJECT_ROOT ?? process.cwd();

export const isKnownBundledSkill = (name: string): boolean =>
	bundledSkillNames.includes(name as (typeof bundledSkillNames)[number]);

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
