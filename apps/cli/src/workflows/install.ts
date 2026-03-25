import {
	type InstallAreaId,
	type InstallationPolicy,
	type InstallPresetId,
	type InstallTarget,
	resolveInstallPreset,
	validateInstallationPolicy,
} from "@mimirmesh/installer";
import { bundledSkillNames } from "@mimirmesh/skills";
import type {
	WorkflowDefinition,
	WorkflowEvidenceRow,
	WorkflowTerminalOutcome,
} from "@mimirmesh/ui";

import {
	initializeProject,
	installIde,
	installSkills,
	loadCliContext,
	previewInstallExecution,
	runtimeAction,
} from "../lib/context";

type InstallWorkflowOptions = {
	policy: InstallationPolicy;
	autoConfirmManagedUpdates?: boolean;
	confirmedUpdatedFiles?: string[];
	plannedPreview?: Awaited<ReturnType<typeof previewInstallExecution>>;
};

const runtimeEvidence = (state: string, message: string): WorkflowEvidenceRow[] => [
	{ label: "Runtime state", value: state },
	{ label: "Runtime message", value: message },
];

const runtimeBlockedCapabilities = (
	runtimeState: string,
	specKitReady: boolean,
): WorkflowTerminalOutcome["blockedCapabilities"] => {
	if (runtimeState === "ready" && specKitReady) {
		return [];
	}
	if (!specKitReady) {
		return ["Spec Kit dependent workflows"];
	}
	if (runtimeState === "failed") {
		return ["Runtime lifecycle control", "MCP passthrough discovery"];
	}
	return ["Runtime-backed workflows"];
};

const createOverwriteGuardOutcome = (
	message: string,
	nextAction: string,
): WorkflowTerminalOutcome => ({
	kind: "failed",
	message,
	impact: "Install-managed changes were not applied.",
	completedWork: [],
	blockedCapabilities: ["Install-managed updates"],
	nextAction,
});

export const createInstallWorkflow = ({
	policy,
	autoConfirmManagedUpdates = false,
	confirmedUpdatedFiles = [],
	plannedPreview,
}: InstallWorkflowOptions): WorkflowDefinition => ({
	id: "install",
	title: "Install MímirMesh",
	description:
		"Guide repository installation, optional integrations, and final readiness verification through one workflow.",
	category: "setup",
	entryModes: ["tui-launcher", "direct-command"],
	interactivePolicy: "default-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["runtime-status", "install-ide", "skills-install"],
	steps: [
		{ id: "load-context", label: "Load project context", kind: "validation" },
		{
			id: "detect-install-state",
			label: "Detect install state and plan changes",
			kind: "discovery",
		},
		{ id: "execute-core", label: "Apply core repository install", kind: "generation" },
		{ id: "install-ide", label: "Apply IDE integration", kind: "generation" },
		{ id: "install-skills", label: "Install bundled skills", kind: "generation" },
		{ id: "verify-runtime", label: "Verify runtime readiness", kind: "validation" },
	],
	execute: async ({ controller }) => {
		const validation = validateInstallationPolicy(policy);
		if (!validation.ok) {
			return createOverwriteGuardOutcome(
				validation.errors.join(" "),
				"Re-run `mimirmesh install` with an explicit preset or area selection.",
			);
		}

		controller.startStep(
			"load-context",
			"Loading project-local config, runtime paths, and repository context.",
		);
		const context = await loadCliContext();
		controller.completeStep("load-context", {
			evidence: [{ label: "Project root", value: context.projectRoot }],
		});

		controller.startStep(
			"detect-install-state",
			"Detecting current install state and computing install-managed changes.",
		);
		const preview = plannedPreview ?? (await previewInstallExecution(context, policy));
		const selectedPreset = resolveInstallPreset(policy.presetId as InstallPresetId | undefined);
		controller.completeStep("detect-install-state", {
			summary: `Preset ${selectedPreset.label} resolved ${policy.selectedAreas.length} install area(s).`,
			evidence: [
				{ label: "Preset", value: selectedPreset.id },
				{ label: "Selected areas", value: policy.selectedAreas.join(", ") },
				{ label: "Created paths", value: String(preview.summary.createdFiles.length) },
				{ label: "Updated paths", value: String(preview.summary.updatedFiles.length) },
			],
		});

		const missingConfirmations = preview.summary.updatedFiles.filter(
			(path) => !confirmedUpdatedFiles.includes(path),
		);
		if (missingConfirmations.length > 0 && !autoConfirmManagedUpdates) {
			controller.failStep("detect-install-state", {
				summary: "Install-managed changes require explicit confirmation before execution.",
				evidence: missingConfirmations.map((path) => ({
					label: "Pending update",
					value: path,
				})),
			});
			return createOverwriteGuardOutcome(
				"Install-managed updates require interactive confirmation before they can be applied.",
				"Re-run `mimirmesh install` interactively to review the pending changes or pass `--yes` in non-interactive mode.",
			);
		}
		if (missingConfirmations.length > 0 && autoConfirmManagedUpdates) {
			controller.addWarning({
				id: "install-auto-confirm-updates",
				label: "Install",
				message: "Install-managed updates were auto-confirmed for this non-interactive run.",
			});
		}

		let coreResult: Awaited<ReturnType<typeof initializeProject>> | null = null;
		if (policy.selectedAreas.includes("core")) {
			controller.startStep(
				"execute-core",
				"Scaffolding docs, runtime files, reports, Spec Kit, and repository analysis.",
			);
			coreResult = await initializeProject(context);
			const coreEvidence = [
				{ label: "Repo shape", value: coreResult.analysis.shape },
				{ label: "Reports generated", value: String(coreResult.reports.length) },
				{ label: "Spec Kit", value: coreResult.specKit.ready ? "ready" : "needs setup" },
			];
			if (coreResult.specKit.ready && coreResult.runtimeState === "ready") {
				controller.completeStep("execute-core", {
					summary: "Core repository install completed.",
					evidence: coreEvidence,
				});
			} else {
				controller.degradeStep("execute-core", {
					summary: "Core install completed with follow-up work still required.",
					evidence: coreEvidence,
				});
			}
		} else {
			controller.skipStep("execute-core", "Core install was not selected for this run.");
		}

		let ideResults: Array<{
			configPath: string;
			serverCommand: string;
			serverArgs: string[];
			target: InstallTarget;
		}> = [];
		if (policy.selectedAreas.includes("ide") && policy.ideTargets.length > 0) {
			controller.startStep(
				"install-ide",
				`Writing IDE integration for ${policy.ideTargets.join(", ")}.`,
			);
			ideResults = await Promise.all(
				policy.ideTargets.map(async (target) => ({
					...(await installIde(context, target)),
					target,
				})),
			);
			controller.completeStep("install-ide", {
				evidence: ideResults.map((result) => ({
					label: `${result.target} config`,
					value: result.configPath,
				})),
			});
		} else {
			controller.skipStep(
				"install-ide",
				policy.selectedAreas.includes("ide")
					? "IDE integration could not run because no targets were selected."
					: "IDE integration was skipped for this run.",
			);
		}

		const selectedSkills =
			policy.selectedAreas.includes("skills") && policy.selectedSkills.length === 0
				? [...bundledSkillNames]
				: policy.selectedSkills;
		let skillsResult: Awaited<ReturnType<typeof installSkills>> | null = null;
		if (policy.selectedAreas.includes("skills")) {
			controller.startStep("install-skills", "Installing the selected bundled skills.");
			skillsResult = await installSkills(context, selectedSkills);
			if (skillsResult.skipped.length > 0) {
				controller.degradeStep("install-skills", {
					summary: "Bundled skill installation completed with skips.",
					evidence: [
						{ label: "Installed", value: String(skillsResult.installed.length) },
						{ label: "Skipped", value: String(skillsResult.skipped.length) },
					],
				});
			} else {
				controller.completeStep("install-skills", {
					evidence: [{ label: "Installed", value: String(skillsResult.installed.length) }],
				});
			}
		} else {
			controller.skipStep("install-skills", "Bundled skills were skipped for this run.");
		}

		controller.startStep("verify-runtime", "Checking runtime readiness after the install plan.");
		const runtime = await runtimeAction(context, "status");
		const verificationEvidence = runtimeEvidence(runtime.health.state, runtime.message);
		if (runtime.health.state === "ready") {
			controller.completeStep("verify-runtime", {
				summary: "Runtime health checks passed.",
				evidence: verificationEvidence,
			});
		} else if (runtime.ok) {
			controller.degradeStep("verify-runtime", {
				summary: "Install completed, but runtime still needs attention.",
				evidence: verificationEvidence,
			});
			runtime.health.reasons.forEach((reason, index) => {
				controller.addWarning({
					id: `install-runtime-${index}`,
					label: "Runtime",
					message: reason,
				});
			});
		} else {
			controller.failStep("verify-runtime", {
				summary: "Runtime verification failed.",
				evidence: verificationEvidence,
			});
		}

		const degradedAreas: InstallAreaId[] = [
			...(coreResult && (!coreResult.specKit.ready || coreResult.runtimeState !== "ready")
				? (["core"] as const)
				: []),
			...(skillsResult && skillsResult.skipped.length > 0 ? (["skills"] as const) : []),
			...(runtime.health.state !== "ready" ? (["core"] as const) : []),
		];
		const skippedAreas: InstallAreaId[] = [
			...preview.summary.skippedAreas,
			...(policy.selectedAreas.includes("ide") && policy.ideTargets.length === 0
				? (["ide"] as const)
				: []),
		];
		const completedAreas = policy.selectedAreas.filter((area) => !degradedAreas.includes(area));
		const kind = !runtime.ok
			? "failed"
			: degradedAreas.length > 0 || !preview.snapshot.specKitStatus.ready
				? "degraded"
				: "success";

		return {
			kind,
			message:
				kind === "success"
					? "Install completed and the runtime is ready."
					: kind === "degraded"
						? "Install completed with follow-up work still required."
						: "Install stopped before the runtime reached a usable state.",
			impact:
				kind === "success"
					? "The repository is installed with the selected areas and runtime-backed workflows are ready."
					: kind === "degraded"
						? "The repository install plan was applied, but one or more operator-facing capabilities still need attention."
						: "The repository has partial install state, but runtime-backed workflows remain unavailable.",
			completedWork: [
				"Loaded the project-local install context",
				...(policy.selectedAreas.includes("core")
					? ["Applied core repository install actions"]
					: []),
				...(ideResults.length > 0
					? [`Installed ${ideResults.length} IDE integration target(s)`]
					: []),
				...(skillsResult ? [`Installed ${skillsResult.installed.length} bundled skill(s)`] : []),
			],
			blockedCapabilities: runtimeBlockedCapabilities(
				runtime.health.state,
				preview.snapshot.specKitStatus.ready,
			),
			nextAction:
				kind === "success"
					? "Run `mimirmesh runtime status` or open `mimirmesh` to inspect the installed repository."
					: !preview.snapshot.specKitStatus.ready
						? "Run `mimirmesh speckit init` or review the Spec Kit installation before relying on spec-driven workflows."
						: "Run `mimirmesh runtime status` or `mimirmesh doctor` to inspect the blocking runtime condition.",
			evidence: [
				{ label: "Selected preset", value: selectedPreset.id },
				{ label: "Selected areas", value: policy.selectedAreas.join(", ") },
				{ label: "Completed areas", value: completedAreas.join(", ") || "None" },
				{ label: "Skipped areas", value: skippedAreas.join(", ") || "None" },
				...verificationEvidence,
			],
			machineReadablePayload: {
				selectedPreset: selectedPreset.id,
				selectedAreas: policy.selectedAreas,
				selectedIdeTargets: policy.ideTargets,
				completedAreas,
				skippedAreas,
				degradedAreas,
				updatedFiles: preview.summary.updatedFiles,
				runtimeStatus: runtime.health,
				summary: preview.summary,
			},
		};
	},
});
