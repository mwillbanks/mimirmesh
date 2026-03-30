import type {
	RouteTelemetryScope,
	RuntimeActionResult,
	RuntimeHealth,
	RuntimeUpgradeActionResult,
	UpgradeStatusReport,
} from "@mimirmesh/runtime";
import type {
	WorkflowDefinition,
	WorkflowEvidenceRow,
	WorkflowTerminalOutcome,
} from "@mimirmesh/ui";

import {
	loadCliContext,
	mcpInspectToolSurface,
	runtimeAction,
	runtimeClearRouteTelemetry,
	runtimeCompactRouteTelemetry,
	runtimeDoctor,
	runtimeUpgradeMigrate,
	runtimeUpgradeRepair,
	runtimeUpgradeStatus,
} from "../lib/context";

const unique = <T>(items: T[]): T[] => [...new Set(items)];

const runtimeActionTitle = (action: RuntimeActionResult["action"]): string => {
	switch (action) {
		case "start":
			return "Start Runtime";
		case "stop":
			return "Stop Runtime";
		case "restart":
			return "Restart Runtime";
		case "refresh":
			return "Refresh Runtime";
		case "status":
			return "Inspect Runtime Status";
	}
};

const runtimeOutcomeKind = (health: RuntimeHealth): WorkflowTerminalOutcome["kind"] =>
	health.state === "ready"
		? "success"
		: health.state === "degraded" || health.state === "bootstrapping"
			? "degraded"
			: "failed";

const runtimeEvidence = (result: RuntimeActionResult): WorkflowEvidenceRow[] => [
	{ label: "Runtime state", value: result.health.state },
	{ label: "Docker installed", value: String(result.health.dockerInstalled) },
	{ label: "Docker daemon", value: String(result.health.dockerDaemonRunning) },
	{ label: "Compose available", value: String(result.health.composeAvailable) },
	{ label: "Service count", value: String(result.health.services.length) },
	{ label: "Upgrade state", value: result.health.upgradeState ?? "unknown" },
];

const runtimeBlockedCapabilities = (health: RuntimeHealth): string[] => {
	const blocked: string[] = [];
	if (!health.dockerInstalled || !health.dockerDaemonRunning || !health.composeAvailable) {
		blocked.push("Project-local Docker runtime");
	}
	if (health.state !== "ready") {
		blocked.push("MCP passthrough discovery");
	}
	if (health.upgradeState && health.upgradeState !== "current") {
		blocked.push("Fully current runtime upgrade state");
	}
	return unique(blocked);
};

const upgradeOutcomeKind = (
	report: UpgradeStatusReport,
	resultKind?: RuntimeUpgradeActionResult["outcome"] extends infer T
		? T extends { result: infer R }
			? R
			: never
		: never,
): WorkflowTerminalOutcome["kind"] => {
	if (resultKind === "failed" || resultKind === "blocked" || report.state === "blocked") {
		return "failed";
	}
	if (resultKind === "degraded" || report.state !== "current") {
		return "degraded";
	}
	return "success";
};

const upgradeBlockedCapabilities = (report: UpgradeStatusReport): string[] =>
	report.requiredActions.includes("manual-intervention")
		? ["Automatic in-place runtime upgrade"]
		: report.state === "degraded" || report.state === "repairable"
			? ["Fully healthy preserved runtime assets"]
			: [];

const upgradeEvidence = (report: UpgradeStatusReport): WorkflowEvidenceRow[] => [
	{ label: "Upgrade state", value: report.state },
	{ label: "Required actions", value: report.requiredActions.join(", ") || "none" },
	{ label: "Drift categories", value: report.driftCategories.join(", ") || "none" },
];

const requiresRuntimeRestart = (report: UpgradeStatusReport | null | undefined): boolean =>
	Boolean(report?.requiredActions.includes("restart-runtime"));

const runtimeRestartGuidance =
	"Run `mimirmesh runtime restart --non-interactive` to reload Docker containers with the current runtime definition and engine images.";

const telemetryScopeLabel = (scope: RouteTelemetryScope): string => {
	switch (scope.scope) {
		case "repo":
			return "repository";
		case "tool":
			return `tool ${scope.unifiedTool}`;
		case "route":
			return `route ${scope.unifiedTool} (${scope.engine}:${scope.engineTool})`;
	}
};

export const createRuntimeActionWorkflow = (
	action: RuntimeActionResult["action"],
): WorkflowDefinition => ({
	id: `runtime-${action}`,
	title: runtimeActionTitle(action),
	description:
		action === "status"
			? "Inspect live runtime readiness, Docker availability, and upgrade drift."
			: `Run the ${action} lifecycle operation and verify the resulting project-local runtime state.`,
	category: "runtime",
	entryModes: ["tui-embedded", "direct-command"],
	interactivePolicy: action === "status" ? "default-non-interactive" : "default-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions:
		action === "status"
			? ["runtime-upgrade-status", "doctor"]
			: ["runtime-status", "runtime-upgrade-status"],
	steps:
		action === "status"
			? [
					{ id: "load-context", label: "Load runtime context", kind: "validation" },
					{ id: "inspect-runtime", label: "Inspect live runtime state", kind: "discovery" },
				]
			: [
					{ id: "load-context", label: "Load runtime context", kind: "validation" },
					{
						id: "execute-action",
						label: `Run ${action} against the runtime`,
						kind: "runtime-action",
					},
					{ id: "verify-runtime", label: "Verify resulting runtime state", kind: "validation" },
				],
	execute: async ({ controller }) => {
		controller.startStep(
			"load-context",
			"Loading project-local config, logging, and runtime files.",
		);
		const context = await loadCliContext();
		controller.completeStep("load-context", {
			evidence: [{ label: "Project root", value: context.projectRoot }],
		});

		if (action === "status") {
			controller.startStep("inspect-runtime", "Running live Docker, runtime, and routing checks.");
			const status = await runtimeAction(context, "status");
			const toolSurface = await mcpInspectToolSurface(context);
			const evidence = [
				...runtimeEvidence(status),
				{
					label: "Loaded MCP groups",
					value: toolSurface.loadedEngineGroups.join(", ") || "none",
				},
				{
					label: "Deferred MCP groups",
					value:
						toolSurface.deferredEngineGroups
							.filter((group) => group.availabilityState !== "loaded")
							.map((group) => group.engineId)
							.join(", ") || "none",
				},
			];
			if (status.health.state === "ready") {
				controller.completeStep("inspect-runtime", {
					summary: "Runtime is ready.",
					evidence,
				});
			} else if (status.ok) {
				controller.degradeStep("inspect-runtime", {
					summary: "Runtime is reachable but degraded.",
					evidence,
				});
			} else {
				controller.failStep("inspect-runtime", {
					summary: "Runtime is unavailable.",
					evidence,
				});
			}
			status.health.reasons.forEach((reason, index) => {
				controller.addWarning({
					id: `runtime-status-${index}`,
					label: "Runtime",
					message: reason,
				});
			});

			const kind = runtimeOutcomeKind(status.health);
			return {
				kind,
				message:
					kind === "success"
						? "Runtime is ready."
						: kind === "degraded"
							? "Runtime is degraded."
							: "Runtime is unavailable.",
				impact:
					kind === "success"
						? "Runtime-backed workflows can use live project-local services."
						: requiresRuntimeRestart(status.upgradeStatus)
							? "Code or runtime definitions changed, but the running Docker containers are still serving the previous build."
							: "One or more runtime-backed workflows are limited until the reported issues are fixed.",
				completedWork: [
					"Loaded project-local runtime context",
					"Ran Docker, runtime, and routing health checks",
				],
				blockedCapabilities: runtimeBlockedCapabilities(status.health),
				nextAction:
					kind === "success"
						? "Continue from the dashboard or use `mimirmesh mcp list-tools`."
						: requiresRuntimeRestart(status.upgradeStatus)
							? runtimeRestartGuidance
							: "Review the reported reasons and run `mimirmesh doctor` or `mimirmesh runtime upgrade repair` if needed.",
				evidence: [...evidence, { label: "Message", value: status.message }],
				machineReadablePayload: {
					...status,
					toolSurface,
				},
			};
		}

		controller.startStep("execute-action", `Running runtime ${action}.`);
		const result = await runtimeAction(context, action);
		const actionEvidence = runtimeEvidence(result);
		if (result.ok) {
			controller.completeStep("execute-action", {
				summary: result.message,
				evidence: actionEvidence,
			});
		} else {
			controller.degradeStep("execute-action", {
				summary: result.message,
				evidence: actionEvidence,
			});
		}

		controller.startStep(
			"verify-runtime",
			"Re-checking live runtime readiness after the lifecycle action.",
		);
		const verified = await runtimeAction(context, "status");
		const verifiedEvidence = runtimeEvidence(verified);
		if (verified.health.state === "ready") {
			controller.completeStep("verify-runtime", {
				evidence: verifiedEvidence,
				summary: "Runtime is ready after the lifecycle action.",
			});
		} else if (verified.ok) {
			controller.degradeStep("verify-runtime", {
				evidence: verifiedEvidence,
				summary: "Runtime completed the action, but follow-up work is still required.",
			});
		} else {
			controller.failStep("verify-runtime", {
				evidence: verifiedEvidence,
				summary: "Runtime did not reach a usable state after the action.",
			});
		}
		verified.health.reasons.forEach((reason, index) => {
			controller.addWarning({
				id: `runtime-${action}-${index}`,
				label: "Runtime",
				message: reason,
			});
		});

		const kind = runtimeOutcomeKind(verified.health);

		return {
			kind,
			message:
				kind === "success"
					? `${runtimeActionTitle(action)} completed.`
					: kind === "degraded"
						? `${runtimeActionTitle(action)} completed with follow-up work required.`
						: `${runtimeActionTitle(action)} did not produce a usable runtime.`,
			impact:
				kind === "success"
					? "Runtime lifecycle state now matches the requested action."
					: "The requested lifecycle action ran, but runtime-backed workflows remain limited.",
			completedWork: ["Loaded project-local runtime context", `Executed runtime ${action}`],
			blockedCapabilities: runtimeBlockedCapabilities(verified.health),
			nextAction:
				kind === "success"
					? "Use `mimirmesh runtime status` or the dashboard to confirm the new state."
					: requiresRuntimeRestart(verified.upgradeStatus)
						? runtimeRestartGuidance
						: "Inspect the runtime reasons and rerun the lifecycle action once the blocking issue is fixed.",
			evidence: [...verifiedEvidence, { label: "Action message", value: result.message }],
			machineReadablePayload: {
				action: result,
				verified,
			},
		};
	},
});

export const createRuntimeUpgradeStatusWorkflow = (): WorkflowDefinition => ({
	id: "runtime-upgrade-status",
	title: "Inspect Runtime Upgrade State",
	description:
		"Classify runtime upgrade drift, repairability, and preserved-asset warnings from live project state.",
	category: "upgrade",
	entryModes: ["tui-embedded", "direct-command"],
	interactivePolicy: "default-non-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["runtime-upgrade-migrate", "runtime-upgrade-repair"],
	steps: [
		{ id: "load-context", label: "Load runtime upgrade context", kind: "validation" },
		{ id: "inspect-upgrade", label: "Inspect runtime upgrade drift", kind: "discovery" },
	],
	execute: async ({ controller }) => {
		controller.startStep("load-context", "Loading runtime config and upgrade metadata.");
		const context = await loadCliContext();
		controller.completeStep("load-context", {
			evidence: [{ label: "Project root", value: context.projectRoot }],
		});

		controller.startStep(
			"inspect-upgrade",
			"Checking project-local runtime upgrade drift and required actions.",
		);
		const result = await runtimeUpgradeStatus(context);
		const evidence = upgradeEvidence(result.report);
		if (result.report.state === "current") {
			controller.completeStep("inspect-upgrade", {
				evidence,
				summary: "Runtime upgrade state is current.",
			});
		} else if (result.report.state === "blocked") {
			controller.failStep("inspect-upgrade", {
				evidence,
				summary: "Automatic runtime upgrade is blocked.",
			});
		} else {
			controller.degradeStep("inspect-upgrade", {
				evidence,
				summary: "Runtime upgrade work is still required.",
			});
		}
		result.report.warnings.forEach((warning, index) => {
			controller.addWarning({
				id: `upgrade-status-${index}`,
				label: "Upgrade",
				message: warning,
			});
		});

		const kind = upgradeOutcomeKind(result.report);
		return {
			kind,
			message:
				kind === "success"
					? "Runtime upgrade state is current."
					: kind === "degraded"
						? "Runtime upgrade work is still required."
						: "Automatic runtime upgrade is blocked.",
			impact:
				kind === "success"
					? "No migration or repair work is currently required."
					: "Upgrade-related workflows still require action before the runtime is fully current.",
			completedWork: [
				"Loaded runtime upgrade metadata",
				"Classified runtime drift and required actions",
			],
			blockedCapabilities: upgradeBlockedCapabilities(result.report),
			nextAction:
				result.report.state === "current"
					? "Continue with normal runtime workflows."
					: result.report.state === "blocked"
						? "Follow the required manual intervention path before retrying."
						: result.report.requiredActions.includes("restart-runtime")
							? runtimeRestartGuidance
							: result.report.requiredActions.includes("repair-state")
								? "Run `mimirmesh runtime upgrade repair`."
								: "Run `mimirmesh runtime upgrade migrate`.",
			evidence,
			machineReadablePayload: result,
		};
	},
});

export const createRuntimeTelemetryCompactWorkflow = (
	scope: RouteTelemetryScope,
	deps: {
		loadContext?: typeof loadCliContext;
		compactTelemetry?: typeof runtimeCompactRouteTelemetry;
	} = {},
): WorkflowDefinition => ({
	id: "runtime-telemetry-compact",
	title: "Compact Route Telemetry",
	description:
		"Run route-telemetry rollup and snapshot maintenance for the selected scope using the shared runtime service.",
	category: "runtime",
	entryModes: ["tui-embedded", "direct-command"],
	interactivePolicy: "default-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["runtime-status", "mcp-route-hints"],
	steps: [
		{ id: "load-context", label: "Load runtime context", kind: "validation" },
		{ id: "compact-telemetry", label: "Compact route telemetry", kind: "runtime-action" },
	],
	execute: async ({ controller }) => {
		controller.startStep("load-context", "Loading project-local runtime context.");
		const loadContext = deps.loadContext ?? loadCliContext;
		const compactTelemetry = deps.compactTelemetry ?? runtimeCompactRouteTelemetry;
		const context = await loadContext();
		controller.completeStep("load-context", {
			evidence: [{ label: "Project root", value: context.projectRoot }],
		});

		controller.startStep(
			"compact-telemetry",
			`Running route-telemetry compaction for ${telemetryScopeLabel(scope)}.`,
		);
		const result = await compactTelemetry(context, scope);
		const evidence = [
			{ label: "Scope", value: telemetryScopeLabel(scope) },
			{ label: "Lock acquired", value: String(result.acquired) },
			{ label: "Closed buckets", value: String(result.progress.closedBucketCount) },
			{ label: "Affected labels", value: result.affectedSourceLabels.join(", ") || "none" },
		];
		if (result.acquired) {
			controller.completeStep("compact-telemetry", {
				summary: "Route telemetry compaction completed.",
				evidence,
			});
		} else {
			controller.degradeStep("compact-telemetry", {
				summary:
					"Route telemetry compaction skipped because another maintainer holds the advisory lock.",
				evidence,
			});
		}

		return {
			kind: result.acquired ? "success" : "degraded",
			message: result.acquired
				? `Compacted route telemetry for ${telemetryScopeLabel(scope)}.`
				: `Skipped route telemetry compaction for ${telemetryScopeLabel(scope)} because another maintainer is active.`,
			impact: result.acquired
				? "Rollups and snapshots have been refreshed for the selected scope."
				: "The selected scope was not compacted during this run.",
			completedWork: ["Loaded the project-local runtime context", "Ran route-telemetry compaction"],
			blockedCapabilities: result.acquired ? [] : ["Immediate route-telemetry compaction"],
			nextAction: result.acquired
				? "Inspect the updated route hints or rerun the command if more telemetry arrives."
				: "Retry once the active maintenance run completes.",
			evidence,
			machineReadablePayload: result,
		};
	},
});

export const createRuntimeTelemetryClearWorkflow = (
	scope: RouteTelemetryScope,
	deps: {
		loadContext?: typeof loadCliContext;
		clearTelemetry?: typeof runtimeClearRouteTelemetry;
	} = {},
): WorkflowDefinition => ({
	id: "runtime-telemetry-clear",
	title: "Clear Route Telemetry",
	description:
		"Clear route telemetry for the selected repository, tool, or route scope using the shared runtime service.",
	category: "runtime",
	entryModes: ["tui-embedded", "direct-command"],
	interactivePolicy: "default-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["runtime-status", "mcp-route-hints"],
	steps: [
		{ id: "load-context", label: "Load runtime context", kind: "validation" },
		{ id: "clear-telemetry", label: "Clear route telemetry", kind: "runtime-action" },
	],
	execute: async ({ controller }) => {
		controller.startStep("load-context", "Loading project-local runtime context.");
		const loadContext = deps.loadContext ?? loadCliContext;
		const clearTelemetry = deps.clearTelemetry ?? runtimeClearRouteTelemetry;
		const context = await loadContext();
		controller.completeStep("load-context", {
			evidence: [{ label: "Project root", value: context.projectRoot }],
		});

		controller.startStep(
			"clear-telemetry",
			`Clearing route telemetry for ${telemetryScopeLabel(scope)}.`,
		);
		const result = await clearTelemetry(context, scope);
		const evidence = [
			{ label: "Scope", value: telemetryScopeLabel(scope) },
			{ label: "Cleared at", value: result.clearedAt },
		];
		controller.completeStep("clear-telemetry", {
			summary: "Route telemetry cleared for the requested scope.",
			evidence,
		});

		return {
			kind: "success",
			message: `Cleared route telemetry for ${telemetryScopeLabel(scope)}.`,
			impact:
				"Stored route events, rollups, and snapshots for the selected scope have been removed.",
			completedWork: ["Loaded the project-local runtime context", "Cleared route telemetry"],
			blockedCapabilities: [],
			nextAction:
				"Re-run route-hint inspection or invoke the workflow again after new route activity is recorded.",
			evidence,
			machineReadablePayload: result,
		};
	},
});

const createRuntimeUpgradeExecutionWorkflow = (
	id: "runtime-upgrade-migrate" | "runtime-upgrade-repair",
	action: "migrate" | "repair",
	title: string,
	description: string,
): WorkflowDefinition => ({
	id,
	title,
	description,
	category: action === "repair" ? "repair" : "upgrade",
	entryModes: ["tui-embedded", "direct-command"],
	interactivePolicy: "default-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["runtime-upgrade-status", "runtime-status"],
	steps: [
		{ id: "load-context", label: "Load runtime upgrade context", kind: "validation" },
		{ id: "execute-upgrade", label: `Run ${action} against runtime state`, kind: "runtime-action" },
		{ id: "verify-upgrade", label: "Verify resulting upgrade state", kind: "validation" },
	],
	execute: async ({ controller }) => {
		controller.startStep(
			"load-context",
			"Loading runtime upgrade config, checkpoint, and preserved assets.",
		);
		const context = await loadCliContext();
		controller.completeStep("load-context", {
			evidence: [{ label: "Project root", value: context.projectRoot }],
		});

		controller.startStep("execute-upgrade", `Running runtime upgrade ${action}.`);
		const result =
			action === "migrate"
				? await runtimeUpgradeMigrate(context)
				: await runtimeUpgradeRepair(context);
		const resultEvidence = upgradeEvidence(result.report);
		if (result.ok) {
			controller.completeStep("execute-upgrade", {
				summary: result.message,
				evidence: resultEvidence,
			});
		} else {
			controller.degradeStep("execute-upgrade", {
				summary: result.message,
				evidence: resultEvidence,
			});
		}

		controller.startStep(
			"verify-upgrade",
			"Checking the resulting runtime upgrade classification.",
		);
		const verified = await runtimeUpgradeStatus(context);
		const verifiedEvidence = upgradeEvidence(verified.report);
		const kind = upgradeOutcomeKind(verified.report, result.outcome?.result);
		if (kind === "success") {
			controller.completeStep("verify-upgrade", {
				evidence: verifiedEvidence,
				summary: "Runtime upgrade state is current after the workflow.",
			});
		} else if (kind === "degraded") {
			controller.degradeStep("verify-upgrade", {
				evidence: verifiedEvidence,
				summary: "Runtime upgrade workflow completed with preserved issues still present.",
			});
		} else {
			controller.failStep("verify-upgrade", {
				evidence: verifiedEvidence,
				summary: "Runtime upgrade workflow remains blocked.",
			});
		}
		verified.report.warnings.forEach((warning, index) => {
			controller.addWarning({
				id: `${id}-${index}`,
				label: action === "repair" ? "Repair" : "Upgrade",
				message: warning,
			});
		});

		return {
			kind,
			message:
				kind === "success"
					? `${title} completed.`
					: kind === "degraded"
						? `${title} completed with remaining degraded state.`
						: `${title} could not reach a supported runtime state.`,
			impact:
				kind === "success"
					? "Runtime upgrade metadata and preserved assets match the current CLI expectations."
					: "The requested runtime upgrade work ran, but preserved assets or compatibility still block full readiness.",
			completedWork: [
				"Loaded runtime upgrade context",
				`Ran runtime upgrade ${action}`,
				...(result.completedSteps.length > 0
					? [`Completed steps: ${result.completedSteps.join(", ")}`]
					: []),
			],
			blockedCapabilities: upgradeBlockedCapabilities(verified.report),
			nextAction:
				kind === "success"
					? "Run `mimirmesh runtime status` or open the dashboard to confirm runtime readiness."
					: verified.report.requiredActions.includes("restart-runtime")
						? runtimeRestartGuidance
						: verified.report.requiredActions.includes("repair-state")
							? "Review the degraded asset warnings and rerun `mimirmesh runtime upgrade repair` once safe."
							: "Follow the manual intervention guidance recorded in the upgrade warnings.",
			evidence: [
				...verifiedEvidence,
				{ label: "Action message", value: result.message },
				{ label: "Completed checkpoint steps", value: result.completedSteps.join(", ") || "none" },
			],
			machineReadablePayload: {
				result,
				verified,
			},
		};
	},
});

export const createRuntimeUpgradeMigrateWorkflow = () =>
	createRuntimeUpgradeExecutionWorkflow(
		"runtime-upgrade-migrate",
		"migrate",
		"Migrate Runtime State",
		"Run the supported in-place runtime migration path and verify the resulting upgrade classification.",
	);

export const createRuntimeUpgradeRepairWorkflow = () =>
	createRuntimeUpgradeExecutionWorkflow(
		"runtime-upgrade-repair",
		"repair",
		"Repair Runtime State",
		"Repair resumable or degraded runtime upgrade state and verify preserved assets afterward.",
	);

export const createRuntimeDoctorWorkflow = (): WorkflowDefinition => ({
	id: "runtime-doctor",
	title: "Inspect Runtime Upgrade Health",
	description:
		"Validate preserved runtime assets and report upgrade drift, warnings, and repair needs.",
	category: "repair",
	entryModes: ["tui-launcher", "direct-command"],
	interactivePolicy: "default-non-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["runtime-upgrade-status", "runtime-upgrade-repair"],
	steps: [
		{ id: "load-context", label: "Load runtime doctor context", kind: "validation" },
		{ id: "inspect-runtime", label: "Inspect preserved runtime assets", kind: "validation" },
	],
	execute: async ({ controller }) => {
		controller.startStep("load-context", "Loading runtime upgrade config and preserved assets.");
		const context = await loadCliContext();
		controller.completeStep("load-context", {
			evidence: [{ label: "Project root", value: context.projectRoot }],
		});

		controller.startStep(
			"inspect-runtime",
			"Validating preserved assets against the current runtime rules.",
		);
		const result = await runtimeDoctor(context);
		const evidence = [
			...upgradeEvidence(result.report),
			{ label: "Preserved assets", value: String(result.assets.length) },
			{ label: "Warnings", value: String(result.warnings.length) },
		];
		if (result.warnings.length === 0 && result.report.state === "current") {
			controller.completeStep("inspect-runtime", {
				evidence,
				summary: "Preserved assets validated successfully.",
			});
		} else {
			controller.degradeStep("inspect-runtime", {
				evidence,
				summary: "Preserved asset validation found warnings.",
			});
			[...result.report.warnings, ...result.warnings].forEach((warning, index) => {
				controller.addWarning({
					id: `runtime-doctor-${index}`,
					label: "Runtime doctor",
					message: warning,
				});
			});
		}

		return {
			kind:
				result.warnings.length === 0 && result.report.state === "current" ? "success" : "degraded",
			message:
				result.warnings.length === 0 && result.report.state === "current"
					? "Runtime preserved assets are healthy."
					: "Runtime preserved assets still require attention.",
			impact:
				result.warnings.length === 0 && result.report.state === "current"
					? "No preserved-asset repair work is currently required."
					: "Preserved assets or upgrade drift may still limit runtime upgrade safety.",
			completedWork: ["Loaded runtime upgrade context", "Validated preserved runtime assets"],
			blockedCapabilities:
				result.warnings.length === 0 ? [] : ["Clean preserved runtime asset set"],
			nextAction:
				result.warnings.length === 0
					? "Continue with normal runtime workflows."
					: result.report.requiredActions.includes("restart-runtime")
						? runtimeRestartGuidance
						: "Run `mimirmesh runtime upgrade repair` to repair preserved assets or review the warnings manually.",
			evidence,
			machineReadablePayload: result,
		};
	},
});
