import type { WorkflowDefinition } from "@mimirmesh/ui";

import {
	installSkills,
	listSkills,
	loadCliContext,
	removeSkills,
	updateSkills,
} from "../lib/context";

export const createSkillsInstallWorkflow = (names?: string[]): WorkflowDefinition => ({
	id: "skills-install",
	title: "Install Bundled Skills",
	description:
		"Install bundled MímirMesh skills into the repository-local `.agents/skills/` directory.",
	category: "setup",
	entryModes: ["direct-command"],
	interactivePolicy: "default-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["skills-update", "skills-remove"],
	steps: [
		{ id: "load-context", label: "Load project and skill context", kind: "validation" },
		{ id: "install-skills", label: "Install selected skills", kind: "generation" },
	],
	execute: async ({ controller }) => {
		controller.startStep(
			"load-context",
			"Loading the repository-local context and bundled skill state.",
		);
		const context = await loadCliContext();
		const inventory = await listSkills(context);
		const selectedNames = names ?? inventory.skills.map((skill) => skill.name);
		controller.completeStep("load-context", {
			evidence: [
				{ label: "Project root", value: context.projectRoot },
				{ label: "Install mode", value: inventory.mode },
				{ label: "Selected skills", value: String(selectedNames.length) },
			],
		});

		if (selectedNames.length === 0) {
			controller.skipStep("install-skills", "No skills were selected for installation.");
			return {
				kind: "degraded",
				message: "No bundled skills were selected for installation.",
				impact: "The repository skill surface is unchanged.",
				completedWork: ["Loaded bundled skill inventory"],
				blockedCapabilities: [],
				nextAction: "Select one or more skills and rerun the install command.",
				machineReadablePayload: { selectedNames, inventory },
			};
		}

		controller.startStep("install-skills", "Installing the selected bundled skills.");
		const result = await installSkills(context, selectedNames);
		controller.completeStep("install-skills", {
			evidence: [
				{ label: "Install mode", value: result.mode },
				{ label: "Installed", value: String(result.installed.length) },
			],
		});

		return {
			kind: "success",
			message: `Installed ${result.installed.length} bundled skill(s).`,
			impact: "The repository now exposes the selected MímirMesh skills under `.agents/skills/`.",
			completedWork: [
				"Loaded repository-local skill inventory",
				"Installed the selected bundled skills",
			],
			blockedCapabilities: [],
			nextAction:
				"Run `mimirmesh skills update` after future MímirMesh upgrades if you use copied skills.",
			evidence: [
				{ label: "Mode", value: result.mode },
				...result.installed.map((name, index) => ({
					label: `Installed ${index + 1}`,
					value: name,
				})),
			],
			machineReadablePayload: result,
		};
	},
});

export const createSkillsUpdateWorkflow = (names?: string[]): WorkflowDefinition => ({
	id: "skills-update",
	title: "Update Bundled Skills",
	description:
		"Refresh installed bundled skills that are outdated relative to the current MímirMesh bundle.",
	category: "setup",
	entryModes: ["direct-command"],
	interactivePolicy: "default-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["skills-install", "skills-remove"],
	steps: [
		{ id: "load-context", label: "Load project and installed skill state", kind: "validation" },
		{ id: "update-skills", label: "Update outdated installed skills", kind: "generation" },
	],
	execute: async ({ controller }) => {
		controller.startStep(
			"load-context",
			"Loading the repository-local context and installed skill status.",
		);
		const context = await loadCliContext();
		const inventory = await listSkills(context);
		const selectedNames =
			names ??
			inventory.skills
				.filter((skill) => skill.installed && skill.outdated)
				.map((skill) => skill.name);
		controller.completeStep("load-context", {
			evidence: [
				{ label: "Project root", value: context.projectRoot },
				{ label: "Install mode", value: inventory.mode },
				{ label: "Outdated installed skills", value: String(selectedNames.length) },
			],
		});

		if (selectedNames.length === 0) {
			controller.skipStep("update-skills", "No installed bundled skills require an update.");
			return {
				kind: "success",
				message: "No installed bundled skills require an update.",
				impact: "The repository skill surface is already current.",
				completedWork: ["Loaded installed skill inventory"],
				blockedCapabilities: [],
				nextAction:
					"Run `mimirmesh skills install` if this repository has not installed the bundled skills yet.",
				machineReadablePayload: { selectedNames, inventory },
			};
		}

		controller.startStep("update-skills", "Updating the selected installed skills.");
		const result = await updateSkills(context, selectedNames);
		controller.completeStep("update-skills", {
			evidence: [
				{ label: "Updated", value: String(result.updated.length) },
				{ label: "Skipped", value: String(result.skipped.length) },
			],
		});

		const degraded = result.missing.length > 0;
		return {
			kind: degraded ? "degraded" : "success",
			message: degraded
				? `Updated ${result.updated.length} skill(s), but ${result.missing.length} requested skill(s) were not installed.`
				: `Updated ${result.updated.length} bundled skill(s).`,
			impact: degraded
				? "Installed copied or broken-link skills were refreshed, but some requested skills were not present."
				: "Installed outdated bundled skills were refreshed to match the current MímirMesh bundle.",
			completedWork: [
				"Loaded installed skill inventory",
				"Refreshed the selected outdated bundled skills",
			],
			blockedCapabilities: degraded ? ["Requested updates for missing installed skills"] : [],
			nextAction: degraded
				? "Run `mimirmesh skills install <skill-name>` for any missing skills you want in this repository."
				: "Use `mimirmesh skills remove` to detach bundled skills you no longer want in this repository.",
			evidence: [
				{ label: "Mode", value: result.mode },
				...result.updated.map((name, index) => ({
					label: `Updated ${index + 1}`,
					value: name,
				})),
				...result.missing.map((name, index) => ({
					label: `Missing ${index + 1}`,
					value: name,
				})),
			],
			machineReadablePayload: result,
		};
	},
});

export const createSkillsRemoveWorkflow = (names: string[]): WorkflowDefinition => ({
	id: "skills-remove",
	title: "Remove Installed Skills",
	description:
		"Remove bundled MímirMesh skills from the repository-local `.agents/skills/` directory.",
	category: "setup",
	entryModes: ["direct-command"],
	interactivePolicy: "default-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["skills-install", "skills-update"],
	steps: [
		{ id: "load-context", label: "Load project and installed skill state", kind: "validation" },
		{ id: "remove-skills", label: "Remove selected installed skills", kind: "generation" },
	],
	execute: async ({ controller }) => {
		controller.startStep(
			"load-context",
			"Loading the repository-local context and installed skill state.",
		);
		const context = await loadCliContext();
		controller.completeStep("load-context", {
			evidence: [
				{ label: "Project root", value: context.projectRoot },
				{ label: "Selected skills", value: String(names.length) },
			],
		});

		if (names.length === 0) {
			controller.skipStep("remove-skills", "No skills were selected for removal.");
			return {
				kind: "degraded",
				message: "No installed skills were selected for removal.",
				impact: "The repository skill surface is unchanged.",
				completedWork: ["Loaded installed skill inventory"],
				blockedCapabilities: [],
				nextAction: "Select one or more installed skills and rerun the remove command.",
				machineReadablePayload: { names },
			};
		}

		controller.startStep("remove-skills", "Removing the selected installed bundled skills.");
		const result = await removeSkills(context, names);
		controller.completeStep("remove-skills", {
			evidence: [
				{ label: "Removed", value: String(result.removed.length) },
				{ label: "Skipped", value: String(result.skipped.length) },
			],
		});

		const degraded = result.skipped.length > 0;
		return {
			kind: degraded ? "degraded" : "success",
			message: degraded
				? `Removed ${result.removed.length} skill(s), but ${result.skipped.length} selected skill(s) were not installed.`
				: `Removed ${result.removed.length} installed skill(s).`,
			impact: degraded
				? "Some bundled skills were removed, but one or more selected skills were already absent."
				: "The selected bundled skills are no longer installed in this repository.",
			completedWork: ["Loaded installed skill inventory", "Removed the selected bundled skills"],
			blockedCapabilities: degraded ? ["Removal of missing installed skills"] : [],
			nextAction:
				"Run `mimirmesh skills install` if you want to reattach any removed bundled skills.",
			evidence: [
				...result.removed.map((name, index) => ({
					label: `Removed ${index + 1}`,
					value: name,
				})),
				...result.skipped.map((name, index) => ({
					label: `Skipped ${index + 1}`,
					value: name,
				})),
			],
			machineReadablePayload: result,
		};
	},
});
