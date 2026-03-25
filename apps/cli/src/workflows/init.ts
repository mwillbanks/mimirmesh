import type { InstallTarget } from "@mimirmesh/installer";
import type {
	WorkflowDefinition,
	WorkflowEvidenceRow,
	WorkflowTerminalOutcome,
} from "@mimirmesh/ui";

import {
	applyUpdate,
	collectDashboardSnapshot,
	doctorProject,
	initializeProject,
	installIde,
	loadCliContext,
	refreshProject,
	runtimeAction,
	setupProject,
	updateCheck,
} from "../lib/context";

const runtimeEvidence = (state: string, message: string): WorkflowEvidenceRow[] => [
	{ label: "Runtime state", value: state },
	{ label: "Runtime message", value: message },
];

const outcomeForRuntimeState = (state: string): WorkflowTerminalOutcome["kind"] =>
	state === "ready"
		? "success"
		: state === "degraded" || state === "bootstrapping"
			? "degraded"
			: "failed";

export const createSetupWorkflow = (): WorkflowDefinition => ({
	id: "setup",
	title: "Scaffold Docs and Guidance",
	description: "Prepare the repository documentation structure and operational guidance files.",
	category: "setup",
	entryModes: ["tui-embedded", "direct-command"],
	interactivePolicy: "default-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["install", "runtime-status"],
	steps: [
		{ id: "load-context", label: "Load project context", kind: "validation" },
		{ id: "scaffold-docs", label: "Scaffold documentation structure", kind: "generation" },
	],
	execute: async ({ controller }) => {
		controller.startStep(
			"load-context",
			"Reading project-local MímirMesh config and logger state.",
		);
		const context = await loadCliContext();
		controller.completeStep("load-context", {
			evidence: [{ label: "Project root", value: context.projectRoot }],
		});

		controller.startStep(
			"scaffold-docs",
			"Creating the expected docs directories and guidance file.",
		);
		const directories = await setupProject(context);
		controller.completeStep("scaffold-docs", {
			summary: `Ensured ${directories.length} documentation directories.`,
			evidence: [{ label: "Directories ensured", value: String(directories.length) }],
		});

		return {
			kind: "success",
			message: "Project guidance scaffolding is ready.",
			impact: "Documentation and runbook directories now exist for the project.",
			completedWork: [
				"Loaded the project-local config and logging context",
				"Created the required documentation directories and guidance file",
			],
			blockedCapabilities: [],
			nextAction:
				"Run `mimirmesh install` to initialize runtime files, reports, skills, and health checks.",
			machineReadablePayload: {
				directories,
			},
		};
	},
});

type InitWorkflowOptions = {
	ideTarget?: InstallTarget;
};

export const createInitWorkflow = (options: InitWorkflowOptions = {}): WorkflowDefinition => ({
	id: "init",
	title: "Initialize MímirMesh",
	description:
		"Create project-local runtime state, bootstrap reports, and verify project readiness.",
	category: "setup",
	entryModes: ["tui-embedded", "direct-command"],
	interactivePolicy: "default-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["runtime-status", "install-ide", "report-generate"],
	steps: [
		{ id: "load-context", label: "Load project context", kind: "validation" },
		{ id: "initialize-project", label: "Initialize runtime and reports", kind: "generation" },
		{ id: "install-ide", label: "Install IDE integration", kind: "prompt" },
		{ id: "verify-runtime", label: "Verify runtime readiness", kind: "validation" },
	],
	execute: async ({ controller }) => {
		controller.startStep("load-context", "Reading config, runtime layout, and project logger.");
		const context = await loadCliContext();
		controller.completeStep("load-context", {
			evidence: [{ label: "Project root", value: context.projectRoot }],
		});

		controller.startStep(
			"initialize-project",
			"Scaffolding repository docs, generating runtime files, reports, and repository analysis.",
		);
		const result = await initializeProject(context);
		controller.completeStep("initialize-project", {
			summary:
				"Documentation scaffolding, runtime files, reports, and repository analysis completed.",
			evidence: [
				{ label: "Repo shape", value: result.analysis.shape },
				{ label: "Reports generated", value: String(result.reports.length) },
				{ label: "Spec Kit", value: result.specKit.ready ? "ready" : "needs setup" },
			],
		});

		let ideInstall:
			| {
					configPath: string;
					serverCommand: string;
					serverArgs: string[];
			  }
			| undefined;

		if (options.ideTarget) {
			controller.startStep("install-ide", `Installing ${options.ideTarget} integration.`);
			ideInstall = await installIde(context, options.ideTarget);
			controller.completeStep("install-ide", {
				summary: `${options.ideTarget} integration is configured.`,
				evidence: [{ label: "Config path", value: ideInstall.configPath }],
			});
		} else {
			controller.skipStep("install-ide", "IDE integration was skipped for this run.");
		}

		controller.startStep("verify-runtime", "Checking live runtime readiness after initialization.");
		const runtime = await runtimeAction(context, "status");
		const verificationEvidence = runtimeEvidence(runtime.health.state, runtime.message);
		if (runtime.health.state === "ready") {
			controller.completeStep("verify-runtime", {
				summary: "Runtime health checks passed.",
				evidence: verificationEvidence,
			});
		} else if (runtime.ok) {
			controller.degradeStep("verify-runtime", {
				summary: "Initialization completed, but runtime still needs attention.",
				evidence: verificationEvidence,
			});
			runtime.health.reasons.forEach((reason, index) => {
				controller.addWarning({
					id: `runtime-${index}`,
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

		const kind = !runtime.ok
			? "failed"
			: !result.specKit.ready || runtime.health.state !== "ready"
				? "degraded"
				: "success";

		return {
			kind,
			message:
				kind === "success"
					? "Initialization completed and the runtime is ready."
					: kind === "degraded"
						? "Initialization completed with follow-up work still required."
						: "Initialization stopped before the runtime reached a usable state.",
			impact:
				kind === "success"
					? "Project-local runtime files, reports, and routing state are available for normal use."
					: kind === "degraded"
						? "Project-local state was created, but one or more operator-facing capabilities still need attention."
						: "The project has partial initialization state, but the runtime is not ready for normal use.",
			completedWork: [
				"Loaded the project-local config and logger",
				"Scaffolded documentation directories and generated runtime files and reports",
				...(ideInstall ? [`Installed ${options.ideTarget} IDE integration`] : []),
			],
			blockedCapabilities:
				kind === "success"
					? []
					: runtime.health.state === "failed"
						? ["Runtime lifecycle control", "MCP passthrough discovery"]
						: result.specKit.ready
							? ["Some runtime-backed workflows"]
							: ["Spec Kit dependent workflows"],
			nextAction:
				kind === "success"
					? "Open `mimirmesh` to use the full-screen shell or run `mimirmesh runtime status` for a direct inspection."
					: !result.specKit.ready
						? "Run `mimirmesh speckit init` or review the Spec Kit installation before relying on spec-driven workflows."
						: "Run `mimirmesh runtime status` or `mimirmesh doctor` to inspect the blocking runtime condition.",
			evidence: [
				{ label: "Repo shape", value: result.analysis.shape },
				{ label: "Reports", value: String(result.reports.length) },
				...verificationEvidence,
			],
			machineReadablePayload: {
				analysis: result.analysis,
				reports: result.reports,
				specKit: result.specKit,
				runtime,
				ideInstall,
			},
		};
	},
});

export const createRefreshWorkflow = (): WorkflowDefinition => ({
	id: "refresh",
	title: "Refresh Runtime and Reports",
	description:
		"Refresh runtime state and regenerate project reports using live project-local evidence.",
	category: "setup",
	entryModes: ["tui-launcher", "direct-command"],
	interactivePolicy: "default-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["runtime-status", "report-show"],
	steps: [
		{ id: "load-context", label: "Load project context", kind: "validation" },
		{ id: "refresh-runtime", label: "Refresh runtime state", kind: "runtime-action" },
		{ id: "verify-runtime", label: "Verify refreshed status", kind: "validation" },
	],
	execute: async ({ controller }) => {
		controller.startStep("load-context", "Loading config and runtime context.");
		const context = await loadCliContext();
		controller.completeStep("load-context", {
			evidence: [{ label: "Project root", value: context.projectRoot }],
		});

		controller.startStep("refresh-runtime", "Refreshing runtime and regenerating reports.");
		const result = await refreshProject(context);
		controller.completeStep("refresh-runtime", {
			evidence: [
				{ label: "Runtime message", value: result.runtimeMessage },
				{ label: "Reports regenerated", value: String(result.reports.length) },
			],
		});

		controller.startStep("verify-runtime", "Checking the refreshed runtime status.");
		const runtime = await runtimeAction(context, "status");
		const evidence = runtimeEvidence(runtime.health.state, runtime.message);
		if (runtime.ok) {
			controller.completeStep("verify-runtime", {
				evidence,
				summary:
					runtime.health.state === "ready"
						? "Runtime is ready after refresh."
						: "Runtime remains degraded after refresh.",
			});
		} else {
			controller.failStep("verify-runtime", {
				evidence,
				summary: "Runtime remains unavailable after refresh.",
			});
		}

		const kind = outcomeForRuntimeState(runtime.health.state);

		return {
			kind,
			message:
				kind === "success"
					? "Refresh completed and the runtime is ready."
					: kind === "degraded"
						? "Refresh completed, but runtime issues still require attention."
						: "Refresh completed, but runtime availability is still blocked.",
			impact:
				kind === "success"
					? "Reports and runtime metadata now reflect the current project state."
					: "Reports were refreshed, but runtime-backed workflows are still limited.",
			completedWork: [
				"Reloaded the project-local runtime context",
				"Regenerated the project reports",
			],
			blockedCapabilities: kind === "success" ? [] : ["Runtime-backed workflows"],
			nextAction:
				kind === "success"
					? "Use `mimirmesh runtime status` or the dashboard to inspect the refreshed runtime."
					: "Run `mimirmesh doctor` to inspect the remaining runtime issue before continuing.",
			evidence,
			machineReadablePayload: {
				refresh: result,
				runtime,
			},
		};
	},
});

export const createDoctorWorkflow = (): WorkflowDefinition => ({
	id: "doctor",
	title: "Inspect Project Health",
	description:
		"Check runtime and config health and classify the project as healthy or requiring attention.",
	category: "repair",
	entryModes: ["tui-launcher", "direct-command"],
	interactivePolicy: "default-non-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["runtime-status", "runtime-upgrade-repair"],
	steps: [
		{ id: "load-context", label: "Load project context", kind: "validation" },
		{ id: "inspect-health", label: "Inspect config and runtime health", kind: "validation" },
	],
	execute: async ({ controller }) => {
		controller.startStep("load-context", "Loading config, runtime, and routing context.");
		const context = await loadCliContext();
		controller.completeStep("load-context", {
			evidence: [{ label: "Project root", value: context.projectRoot }],
		});

		controller.startStep("inspect-health", "Running config validation and runtime health checks.");
		const result = await doctorProject(context);
		const evidence = [{ label: "Issue count", value: String(result.issues.length) }];
		if (result.issues.length === 0) {
			controller.completeStep("inspect-health", {
				summary: "No health issues were detected.",
				evidence,
			});
		} else {
			controller.degradeStep("inspect-health", {
				summary: "Health issues were detected.",
				evidence,
			});
			result.issues.forEach((issue, index) => {
				controller.addWarning({
					id: `doctor-${index}`,
					label: "Health",
					message: issue,
				});
			});
		}

		return {
			kind: result.issues.length === 0 ? "success" : "degraded",
			message:
				result.issues.length === 0
					? "Project health checks passed."
					: "Project health checks found issues.",
			impact:
				result.issues.length === 0
					? "Runtime, Docker access, and config validation are in a usable state."
					: "One or more project capabilities are degraded until the reported issues are fixed.",
			completedWork: [
				"Loaded project-local config and runtime state",
				"Validated config and runtime health",
			],
			blockedCapabilities: result.issues.length === 0 ? [] : ["Healthy runtime operation"],
			nextAction:
				result.issues.length === 0
					? "Continue with the dashboard or a direct command."
					: "Review the reported issues and run `mimirmesh runtime status` or `mimirmesh runtime upgrade repair` as needed.",
			evidence,
			machineReadablePayload: result,
		};
	},
});

export const createUpdateWorkflow = (checkOnly = false): WorkflowDefinition => ({
	id: checkOnly ? "update-check" : "update",
	title: checkOnly ? "Check for CLI Updates" : "Apply CLI Update",
	description: checkOnly
		? "Inspect the configured update channel and report whether a newer CLI release is available."
		: "Install the latest CLI release artifacts and verify the updated binary.",
	category: "upgrade",
	entryModes: ["tui-launcher", "direct-command"],
	interactivePolicy: checkOnly ? "default-non-interactive" : "default-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["upgrade", "runtime-upgrade-status"],
	steps: [
		{ id: "load-context", label: "Load project context", kind: "validation" },
		{
			id: checkOnly ? "check-update" : "apply-update",
			label: checkOnly ? "Check configured update channel" : "Install updated CLI artifacts",
			kind: "finalization",
		},
	],
	execute: async ({ controller }) => {
		controller.startStep(
			"load-context",
			"Loading config so the update channel and install path can be inspected.",
		);
		const context = await loadCliContext();
		controller.completeStep("load-context", {
			evidence: [{ label: "Project root", value: context.projectRoot }],
		});

		const stepId = checkOnly ? "check-update" : "apply-update";
		controller.startStep(
			stepId,
			checkOnly
				? "Checking the configured update channel."
				: "Downloading and installing release artifacts.",
		);
		const result = checkOnly ? await updateCheck(context) : await applyUpdate(context);
		controller.completeStep(stepId, {
			evidence:
				"latestVersion" in result
					? [
							{ label: "Current version", value: result.currentVersion },
							{ label: "Latest version", value: result.latestVersion },
						]
					: [
							{ label: "Applied", value: String(result.applied) },
							{ label: "Details", value: result.details },
						],
		});

		if ("latestVersion" in result) {
			return {
				kind: result.updateAvailable ? "degraded" : "success",
				message: result.updateAvailable
					? `A newer CLI release (${result.latestVersion}) is available.`
					: `CLI is current on ${result.currentVersion}.`,
				impact: result.updateAvailable
					? "Current CLI functionality remains usable, but a newer build is available."
					: "The installed CLI matches the configured update channel.",
				completedWork: [
					"Loaded the update channel from project config",
					"Checked the latest available CLI version",
				],
				blockedCapabilities: [],
				nextAction: result.updateAvailable
					? "Run `mimirmesh update` to apply the latest published release artifacts."
					: "Continue using the current CLI build.",
				machineReadablePayload: result,
			};
		}

		return {
			kind: result.applied ? "success" : "degraded",
			message: result.applied
				? "CLI update applied."
				: "CLI update did not replace the current binary.",
			impact: result.applied
				? "The latest release CLI artifacts are installed in the configured bin directory."
				: "The current binary remains in place because no newer artifact was applied, verification failed, or release download was unavailable.",
			completedWork: ["Loaded the project-local update configuration", result.details],
			blockedCapabilities: result.applied ? [] : ["Verified updated CLI binary"],
			nextAction: result.applied
				? "Run `mimirmesh --version` to confirm the installed binary."
				: "Set `MIMIRMESH_GITHUB_REPOSITORY` or provide local `dist/` artifacts, then rerun `mimirmesh update`.",
			machineReadablePayload: result,
		};
	},
});

type InstallIdeWorkflowOptions = {
	target: InstallTarget;
	serverCommand?: string;
};

export const createInstallIdeWorkflow = ({
	target,
	serverCommand,
}: InstallIdeWorkflowOptions): WorkflowDefinition => ({
	id: "install-ide",
	title: "Install IDE Integration",
	description: "Write a project-local MCP configuration file for the selected IDE or agent.",
	category: "integration",
	entryModes: ["tui-launcher", "direct-command"],
	interactivePolicy: "default-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["install", "mcp-list-tools"],
	steps: [
		{ id: "load-context", label: "Load project context", kind: "validation" },
		{ id: "install-config", label: "Write IDE MCP configuration", kind: "generation" },
	],
	execute: async ({ controller }) => {
		controller.startStep("load-context", "Loading project-local config and install paths.");
		const context = await loadCliContext();
		controller.completeStep("load-context", {
			evidence: [{ label: "Project root", value: context.projectRoot }],
		});

		controller.startStep("install-config", `Writing MCP config for ${target}.`);
		const result = await installIde(context, target, serverCommand);
		controller.completeStep("install-config", {
			evidence: [
				{ label: "Config path", value: result.configPath },
				{ label: "Command", value: result.serverCommand },
				{ label: "Args", value: result.serverArgs.join(" ") || "(none)" },
			],
		});

		return {
			kind: "success",
			message: `Installed MCP integration for ${target}.`,
			impact:
				"The selected IDE or agent can now launch the local MímirMesh MCP server using the project-local config file.",
			completedWork: [
				"Loaded the project-local install context",
				`Wrote MCP configuration for ${target}`,
			],
			blockedCapabilities: [],
			nextAction: "Open the IDE or agent and verify it discovers the `mimirmesh` MCP server entry.",
			machineReadablePayload: result,
		};
	},
});

export const createDashboardWorkflow = (): WorkflowDefinition => ({
	id: "dashboard-refresh",
	title: "Refresh Dashboard State",
	description:
		"Collect the current project, runtime, upgrade, and MCP discovery state for the shell.",
	category: "dashboard",
	entryModes: ["tui-embedded"],
	interactivePolicy: "default-non-interactive",
	machineReadableSupported: false,
	requiresProjectContext: true,
	recommendedNextActions: ["install", "runtime-status"],
	steps: [{ id: "collect-state", label: "Collect dashboard state", kind: "discovery" }],
	execute: async ({ controller }) => {
		controller.startStep(
			"collect-state",
			"Inspecting project shape, runtime, upgrade, and MCP discovery state.",
		);
		const snapshot = await collectDashboardSnapshot();
		controller.completeStep("collect-state", {
			evidence: [
				{ label: "Project root", value: snapshot.context.projectRoot },
				{ label: "Runtime", value: snapshot.runtime.health.state },
				{ label: "Upgrade state", value: snapshot.upgrade.report.state },
				{ label: "Tool count", value: String(snapshot.tools.length) },
			],
		});
		return {
			kind: snapshot.runtime.health.state === "ready" ? "success" : "degraded",
			message: "Dashboard state refreshed.",
			impact: "The shell reflects current project-local status and live runtime evidence.",
			completedWork: ["Collected project, runtime, upgrade, and MCP status"],
			blockedCapabilities: [],
			nextAction: "Use the dashboard navigation to launch the next workflow.",
			machineReadablePayload: snapshot,
		};
	},
});
