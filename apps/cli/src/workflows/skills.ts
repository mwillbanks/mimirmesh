import type { WorkflowDefinition } from "@mimirmesh/ui";
import { buildSkillAuthoringPrompt } from "../commands/skills/shared";
import {
	installSkills,
	listSkills,
	loadCliContext,
	mcpCallTool,
	reconcileSkillMaintenanceState,
	removeSkills,
	updateSkills,
} from "../lib/context";
import { createContextWorkflow } from "../lib/context-workflow";

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
				{ label: "AGENTS.md", value: result.guidance.outcome },
				{ label: "Skills config", value: result.configPath },
				{ label: "Registry readiness", value: result.registryReadiness },
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
				{ label: "AGENTS.md", value: result.guidance.outcome },
				{ label: "Skills config", value: result.configPath },
				{ label: "Registry readiness", value: result.registryReadiness },
				...result.installed.map((name, index) => ({
					label: `Installed ${index + 1}`,
					value: name,
				})),
			],
			machineReadablePayload: {
				...result,
				guidanceOutcome: result.guidance.outcome,
			},
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
			const maintenance = await reconcileSkillMaintenanceState(context);
			controller.skipStep("update-skills", "No installed bundled skills require an update.");
			return {
				kind: "success",
				message:
					"No installed bundled skills require an update; repository skill guidance is current.",
				impact: "The repository skill surface is already current.",
				completedWork: [
					"Loaded installed skill inventory",
					"Reconciled skills config and managed guidance state",
				],
				blockedCapabilities: [],
				nextAction:
					"Run `mimirmesh skills install` if this repository has not installed the bundled skills yet.",
				evidence: [
					{ label: "AGENTS.md", value: maintenance.guidance.outcome },
					{ label: "Skills config", value: maintenance.configPath },
					{ label: "Registry readiness", value: maintenance.registryReadiness },
				],
				machineReadablePayload: {
					selectedNames,
					inventory,
					guidanceOutcome: maintenance.guidance.outcome,
					configPath: maintenance.configPath,
					registryReadiness: maintenance.registryReadiness,
				},
			};
		}

		controller.startStep("update-skills", "Updating the selected installed skills.");
		const result = await updateSkills(context, selectedNames);
		controller.completeStep("update-skills", {
			evidence: [
				{ label: "Updated", value: String(result.updated.length) },
				{ label: "Skipped", value: String(result.skipped.length) },
				{ label: "AGENTS.md", value: result.guidance.outcome },
				{ label: "Registry readiness", value: result.registryReadiness },
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
				{ label: "AGENTS.md", value: result.guidance.outcome },
				{ label: "Skills config", value: result.configPath },
				{ label: "Registry readiness", value: result.registryReadiness },
				...result.updated.map((name, index) => ({
					label: `Updated ${index + 1}`,
					value: name,
				})),
				...result.missing.map((name, index) => ({
					label: `Missing ${index + 1}`,
					value: name,
				})),
			],
			machineReadablePayload: {
				...result,
				guidanceOutcome: result.guidance.outcome,
			},
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

type SkillToolWorkflowConfig = {
	id: string;
	title: string;
	description: string;
	toolName: string;
	stepLabel: string;
	stepKind:
		| "validation"
		| "generation"
		| "runtime-action"
		| "discovery"
		| "bootstrap"
		| "prompt"
		| "reporting"
		| "finalization";
	interactivePolicy: "default-interactive" | "default-non-interactive" | "explicit-choice";
	recommendedNextActions: string[];
	request: (context: Awaited<ReturnType<typeof loadCliContext>>) => Record<string, unknown>;
	defaultNextAction: string;
	machineReadablePayload: (
		request: Record<string, unknown>,
		result: Awaited<ReturnType<typeof mcpCallTool>>,
	) => Record<string, unknown>;
	loadContext?: typeof loadCliContext;
	callTool?: typeof mcpCallTool;
};

const createSkillToolWorkflow = ({
	id,
	title,
	description,
	toolName,
	stepLabel,
	stepKind,
	interactivePolicy,
	recommendedNextActions,
	request,
	defaultNextAction,
	machineReadablePayload,
	loadContext = loadCliContext,
	callTool = mcpCallTool,
}: SkillToolWorkflowConfig): WorkflowDefinition =>
	createContextWorkflow({
		id,
		title,
		description,
		category: "configuration",
		interactivePolicy,
		recommendedNextActions,
		stepLabel,
		stepKind,
		loadContext,
		run: async (context) => {
			const toolRequest = request(context);
			try {
				const result = await callTool(context, toolName, toolRequest);
				const status = result.success ? (result.degraded ? "degraded" : "success") : "failed";
				return {
					kind: status,
					message: result.message,
					impact: result.success
						? result.degraded
							? `The ${toolName} skill workflow returned structured results, but the registry reported degraded state.`
							: `The ${toolName} skill workflow returned structured results.`
						: `The ${toolName} skill workflow did not complete successfully.`,
					completedWork: [stepLabel],
					blockedCapabilities: result.success ? [] : [toolName],
					nextAction: result.nextAction ?? defaultNextAction,
					evidence: [
						{ label: "Tool", value: toolName },
						{ label: "Request", value: JSON.stringify(toolRequest) },
						{ label: "Items", value: String(result.items.length) },
					],
					warnings: result.warnings,
					machineReadablePayload: machineReadablePayload(toolRequest, result),
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					kind: "failed",
					message,
					impact: `The ${toolName} skill workflow could not be invoked.`,
					completedWork: [],
					blockedCapabilities: [toolName],
					nextAction: defaultNextAction,
					evidence: [
						{ label: "Tool", value: toolName },
						{ label: "Request", value: JSON.stringify(toolRequest) },
					],
					warnings: [message],
					machineReadablePayload: {
						tool: toolName,
						request: toolRequest,
						error: message,
					},
				};
			}
		},
	});

export const createSkillsFindWorkflow = (
	requestInput: {
		query?: string;
		names?: string[];
		include?: string[];
		limit?: number;
		offset?: number;
	},
	dependencies?: { loadContext?: typeof loadCliContext; callTool?: typeof mcpCallTool },
): WorkflowDefinition =>
	createSkillToolWorkflow({
		id: "skills-find",
		title: "Find Skills",
		description:
			"Discover installed skills with the deterministic skill registry discovery contract.",
		toolName: "skills.find",
		stepLabel: "Discover matching skills",
		stepKind: "discovery",
		interactivePolicy: "default-non-interactive",
		recommendedNextActions: ["skills-read", "skills-resolve", "skills-refresh"],
		request: () => ({
			...(requestInput.query ? { query: requestInput.query } : {}),
			...(requestInput.names && requestInput.names.length > 0 ? { names: requestInput.names } : {}),
			...(requestInput.include && requestInput.include.length > 0
				? { include: requestInput.include }
				: {}),
			...(typeof requestInput.limit === "number" ? { limit: requestInput.limit } : {}),
			...(typeof requestInput.offset === "number" ? { offset: requestInput.offset } : {}),
		}),
		defaultNextAction:
			"Run `mimirmesh skills read <skill-name>` to inspect the smallest useful payload for one skill.",
		machineReadablePayload: (request, result) => ({
			tool: "skills.find",
			request,
			result,
		}),
		...dependencies,
	});

export const createSkillsReadWorkflow = (
	requestInput: {
		name: string;
		mode?: "memory" | "instructions" | "assets" | "full";
		include?: string[];
		select?: Record<string, string[]>;
	},
	dependencies?: { loadContext?: typeof loadCliContext; callTool?: typeof mcpCallTool },
): WorkflowDefinition =>
	createSkillToolWorkflow({
		id: "skills-read",
		title: `Read Skill (${requestInput.name})`,
		description: "Read the smallest useful skill payload with progressive disclosure.",
		toolName: "skills.read",
		stepLabel: "Read the selected skill",
		stepKind: "discovery",
		interactivePolicy: "default-non-interactive",
		recommendedNextActions: ["skills-find", "skills-resolve", "skills-refresh"],
		request: () => ({
			name: requestInput.name,
			...(requestInput.mode ? { mode: requestInput.mode } : {}),
			...(requestInput.include && requestInput.include.length > 0
				? { include: requestInput.include }
				: {}),
			...(requestInput.select ? { select: requestInput.select } : {}),
		}),
		defaultNextAction:
			"Run `mimirmesh skills find` or `mimirmesh skills resolve <prompt>` to choose the next skill to inspect.",
		machineReadablePayload: (request, result) => ({
			tool: "skills.read",
			request,
			result,
		}),
		...dependencies,
	});

export const createSkillsResolveWorkflow = (
	requestInput: {
		prompt: string;
		taskMetadata?: Record<string, unknown>;
		mcpEngineContext?: Record<string, unknown>;
		include?: string[];
		limit?: number;
	},
	dependencies?: { loadContext?: typeof loadCliContext; callTool?: typeof mcpCallTool },
): WorkflowDefinition =>
	createSkillToolWorkflow({
		id: "skills-resolve",
		title: "Resolve Skills",
		description:
			"Rank relevant skills for a prompt using deterministic repository-aware precedence.",
		toolName: "skills.resolve",
		stepLabel: "Resolve matching skills",
		stepKind: "discovery",
		interactivePolicy: "default-non-interactive",
		recommendedNextActions: ["skills-find", "skills-read", "skills-refresh"],
		request: () => ({
			prompt: requestInput.prompt,
			...(requestInput.taskMetadata ? { taskMetadata: requestInput.taskMetadata } : {}),
			...(requestInput.mcpEngineContext ? { mcpEngineContext: requestInput.mcpEngineContext } : {}),
			...(requestInput.include && requestInput.include.length > 0
				? { include: requestInput.include }
				: {}),
			...(typeof requestInput.limit === "number" ? { limit: requestInput.limit } : {}),
		}),
		defaultNextAction: "Run `mimirmesh skills read <skill-name>` on the highest-ranked result.",
		machineReadablePayload: (request, result) => ({
			tool: "skills.resolve",
			request,
			result,
		}),
		...dependencies,
	});

export const createSkillsRefreshWorkflow = (
	requestInput: {
		names?: string[];
		scope?: "repo" | "all";
		invalidateNotFound?: boolean;
		reindexEmbeddings?: boolean;
	},
	dependencies?: { loadContext?: typeof loadCliContext; callTool?: typeof mcpCallTool },
): WorkflowDefinition =>
	createSkillToolWorkflow({
		id: "skills-refresh",
		title: "Refresh Skills",
		description:
			"Refresh repository-scoped skill state, invalidate stale cache assumptions, and reindex when requested.",
		toolName: "skills.refresh",
		stepLabel: "Refresh skill registry state",
		stepKind: "runtime-action",
		interactivePolicy: "default-non-interactive",
		recommendedNextActions: ["skills-find", "skills-resolve", "runtime-status"],
		request: () => ({
			...(requestInput.names && requestInput.names.length > 0 ? { names: requestInput.names } : {}),
			...(requestInput.scope ? { scope: requestInput.scope } : {}),
			...(typeof requestInput.invalidateNotFound === "boolean"
				? { invalidateNotFound: requestInput.invalidateNotFound }
				: {}),
			...(typeof requestInput.reindexEmbeddings === "boolean"
				? { reindexEmbeddings: requestInput.reindexEmbeddings }
				: {}),
		}),
		defaultNextAction: "Run `mimirmesh skills find` again to inspect the refreshed registry state.",
		machineReadablePayload: (request, result) => ({
			tool: "skills.refresh",
			request,
			result,
		}),
		...dependencies,
	});

export const createSkillsCreateWorkflow = (
	requestInput: {
		prompt?: string;
		targetPath?: string;
		template?: string;
		mode?: "analyze" | "generate" | "write";
		includeRecommendations?: boolean;
		includeGapAnalysis?: boolean;
		includeCompletenessAnalysis?: boolean;
		includeConsistencyAnalysis?: boolean;
		validateBeforeWrite?: boolean;
	},
	dependencies?: { loadContext?: typeof loadCliContext; callTool?: typeof mcpCallTool },
): WorkflowDefinition =>
	createSkillToolWorkflow({
		id: "skills-create",
		title: "Create Skill",
		description:
			"Guide new skill authoring with deterministic prompts, templates, validation, and optional writes.",
		toolName: "skills.create",
		stepLabel: "Generate the new skill package",
		stepKind: "generation",
		interactivePolicy: "default-interactive",
		recommendedNextActions: ["skills-update", "skills-find"],
		request: () => ({
			prompt: requestInput.prompt ?? buildSkillAuthoringPrompt("create"),
			...(requestInput.targetPath ? { targetPath: requestInput.targetPath } : {}),
			...(requestInput.template ? { template: requestInput.template } : {}),
			...(requestInput.mode ? { mode: requestInput.mode } : { mode: "generate" }),
			...(typeof requestInput.includeRecommendations === "boolean"
				? { includeRecommendations: requestInput.includeRecommendations }
				: { includeRecommendations: true }),
			...(typeof requestInput.includeGapAnalysis === "boolean"
				? { includeGapAnalysis: requestInput.includeGapAnalysis }
				: { includeGapAnalysis: true }),
			...(typeof requestInput.includeCompletenessAnalysis === "boolean"
				? { includeCompletenessAnalysis: requestInput.includeCompletenessAnalysis }
				: { includeCompletenessAnalysis: true }),
			...(typeof requestInput.includeConsistencyAnalysis === "boolean"
				? { includeConsistencyAnalysis: requestInput.includeConsistencyAnalysis }
				: { includeConsistencyAnalysis: true }),
			...(typeof requestInput.validateBeforeWrite === "boolean"
				? { validateBeforeWrite: requestInput.validateBeforeWrite }
				: { validateBeforeWrite: true }),
		}),
		defaultNextAction:
			"Run `mimirmesh skills update <skill-name>` to refine an existing skill package.",
		machineReadablePayload: (request, result) => ({
			tool: "skills.create",
			request,
			result,
		}),
		...dependencies,
	});

export const createSkillsAuthoringUpdateWorkflow = (
	requestInput: {
		name: string;
		prompt?: string;
		targetPath?: string;
		template?: string;
		mode?: "analyze" | "patchPlan" | "write";
		includeRecommendations?: boolean;
		includeGapAnalysis?: boolean;
		includeCompletenessAnalysis?: boolean;
		includeConsistencyAnalysis?: boolean;
		validateBeforeWrite?: boolean;
		validateAfterWrite?: boolean;
	},
	dependencies?: { loadContext?: typeof loadCliContext; callTool?: typeof mcpCallTool },
): WorkflowDefinition =>
	createSkillToolWorkflow({
		id: "skills-authoring-update",
		title: `Update Skill (${requestInput.name})`,
		description:
			"Guide deterministic updates to an existing skill package while preserving full fidelity.",
		toolName: "skills.update",
		stepLabel: "Generate the skill update plan",
		stepKind: "generation",
		interactivePolicy: "default-interactive",
		recommendedNextActions: ["skills-find", "skills-read", "skills-create"],
		request: () => ({
			name: requestInput.name,
			prompt: requestInput.prompt ?? buildSkillAuthoringPrompt("update", requestInput.name),
			...(requestInput.targetPath ? { targetPath: requestInput.targetPath } : {}),
			...(requestInput.template ? { template: requestInput.template } : {}),
			...(requestInput.mode ? { mode: requestInput.mode } : { mode: "patchPlan" }),
			...(typeof requestInput.includeRecommendations === "boolean"
				? { includeRecommendations: requestInput.includeRecommendations }
				: { includeRecommendations: true }),
			...(typeof requestInput.includeGapAnalysis === "boolean"
				? { includeGapAnalysis: requestInput.includeGapAnalysis }
				: { includeGapAnalysis: true }),
			...(typeof requestInput.includeCompletenessAnalysis === "boolean"
				? { includeCompletenessAnalysis: requestInput.includeCompletenessAnalysis }
				: { includeCompletenessAnalysis: true }),
			...(typeof requestInput.includeConsistencyAnalysis === "boolean"
				? { includeConsistencyAnalysis: requestInput.includeConsistencyAnalysis }
				: { includeConsistencyAnalysis: true }),
			...(typeof requestInput.validateBeforeWrite === "boolean"
				? { validateBeforeWrite: requestInput.validateBeforeWrite }
				: { validateBeforeWrite: true }),
			...(typeof requestInput.validateAfterWrite === "boolean"
				? { validateAfterWrite: requestInput.validateAfterWrite }
				: { validateAfterWrite: true }),
		}),
		defaultNextAction:
			"Run `mimirmesh skills read <skill-name>` to inspect the updated package details.",
		machineReadablePayload: (request, result) => ({
			tool: "skills.update",
			request,
			result,
		}),
		...dependencies,
	});
