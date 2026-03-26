import type { EngineId } from "@mimirmesh/config";
import type { WorkflowDefinition } from "@mimirmesh/ui";

import {
	loadCliContext,
	mcpCallTool,
	mcpInspectToolSchema,
	mcpInspectToolSurface,
	mcpLoadDeferredTools,
	runtimeAction,
} from "../lib/context";

export const createMcpListToolsWorkflow = (): WorkflowDefinition => ({
	id: "mcp-list-tools",
	title: "Inspect MCP Tools",
	description:
		"List core, deferred, and loaded MCP tool surfaces using session-scoped policy and live runtime routing state.",
	category: "mcp",
	entryModes: ["tui-embedded", "direct-command"],
	interactivePolicy: "default-non-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["mcp-load-tools", "mcp-tool-schema", "runtime-status"],
	steps: [
		{ id: "load-context", label: "Load MCP context", kind: "validation" },
		{ id: "inspect-runtime", label: "Check runtime readiness", kind: "discovery" },
		{ id: "inspect-surface", label: "Inspect session tool surface", kind: "discovery" },
	],
	execute: async ({ controller }) => {
		controller.startStep("load-context", "Loading project-local config, logger, and MCP router.");
		const context = await loadCliContext();
		controller.completeStep("load-context", {
			evidence: [
				{ label: "Project root", value: context.projectRoot },
				{ label: "Session", value: context.sessionId },
			],
		});

		controller.startStep(
			"inspect-runtime",
			"Checking runtime health before reporting deferred groups.",
		);
		const runtime = await runtimeAction(context, "status");
		const runtimeEvidence = [
			{ label: "Runtime state", value: runtime.health.state },
			{ label: "Runtime message", value: runtime.message },
		];
		if (runtime.health.state === "ready") {
			controller.completeStep("inspect-runtime", { evidence: runtimeEvidence });
		} else {
			controller.degradeStep("inspect-runtime", {
				summary: "Runtime-backed deferred groups may be unavailable.",
				evidence: runtimeEvidence,
			});
			runtime.health.reasons.forEach((reason, index) => {
				controller.addWarning({
					id: `mcp-runtime-${index}`,
					label: "Runtime",
					message: reason,
				});
			});
		}

		controller.startStep("inspect-surface", "Reading the current session tool surface.");
		const surface = await mcpInspectToolSurface(context);
		controller.completeStep("inspect-surface", {
			evidence: [
				{ label: "Visible tools", value: String(surface.toolCount) },
				{ label: "Core tools", value: String(surface.coreToolCount) },
				{
					label: "Loaded groups",
					value: surface.loadedEngineGroups.join(", ") || "none",
				},
				{
					label: "Deferred groups",
					value:
						surface.deferredEngineGroups
							.filter((group) => group.availabilityState !== "loaded")
							.map((group) => group.engineId)
							.join(", ") || "none",
				},
			],
		});

		return {
			kind: runtime.health.state === "ready" ? "success" : "degraded",
			message: `Session ${surface.sessionId} exposes ${surface.toolCount} visible MCP tools.`,
			impact:
				runtime.health.state === "ready"
					? "Core tools and deferred-load controls are available with live runtime readiness."
					: "Core tools are available, but deferred engine groups may not load until runtime issues are fixed.",
			completedWork: [
				"Loaded the project-local MCP context",
				"Checked runtime readiness",
				"Inspected the current session tool surface",
			],
			blockedCapabilities:
				runtime.health.state === "ready"
					? []
					: ["Healthy deferred-engine loading for all MCP groups"],
			nextAction: surface.deferredEngineGroups.some(
				(group) => group.availabilityState === "deferred",
			)
				? "Run `mimirmesh mcp load-tools <engine>` to load a deferred engine group."
				: "Run `mimirmesh mcp tool <name>` or `mimirmesh mcp tool-schema <name>`.",
			evidence: [
				{ label: "Policy version", value: surface.policyVersion },
				{ label: "Compression", value: surface.compressionLevel },
				{ label: "Tool count", value: String(surface.toolCount) },
				...surface.tools.slice(0, 10).map((tool, index) => ({
					label: `Tool ${index + 1}`,
					value: `${tool.name} [${tool.type}/${tool.sessionState ?? "n/a"}]`,
				})),
			],
			machineReadablePayload: {
				sessionId: surface.sessionId,
				policyVersion: surface.policyVersion,
				coreToolCount: surface.coreToolCount,
				loadedEngineGroups: surface.loadedEngineGroups,
				deferredEngineGroups: surface.deferredEngineGroups,
				compressionLevel: surface.compressionLevel,
				toolCount: surface.toolCount,
				diagnostics: surface.diagnostics,
				tools: surface.tools,
				runtime,
			},
		};
	},
});

export const createMcpLoadToolsWorkflow = (engine: EngineId): WorkflowDefinition => ({
	id: "mcp-load-tools",
	title: `Load MCP Tools (${engine})`,
	description: "Load a deferred engine group into the current session with visible progress.",
	category: "mcp",
	entryModes: ["tui-embedded", "direct-command"],
	interactivePolicy: "default-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["mcp-list-tools", "runtime-status"],
	steps: [
		{ id: "load-context", label: "Load MCP context", kind: "validation" },
		{ id: "load-engine", label: "Load deferred engine group", kind: "runtime-action" },
	],
	execute: async ({ controller }) => {
		controller.startStep("load-context", "Loading project-local MCP context.");
		const context = await loadCliContext();
		controller.completeStep("load-context", {
			evidence: [
				{ label: "Project root", value: context.projectRoot },
				{ label: "Session", value: context.sessionId },
			],
		});

		controller.startStep("load-engine", `Loading deferred engine group ${engine}.`);
		const surface = await mcpLoadDeferredTools(context, engine);
		controller.completeStep("load-engine", {
			summary: `Loaded ${engine} into the current session.`,
			evidence: [
				{ label: "Loaded groups", value: surface.loadedEngineGroups.join(", ") || "none" },
				{ label: "Visible tools", value: String(surface.toolCount) },
			],
		});

		return {
			kind: "success",
			message: `Loaded deferred engine group ${engine}.`,
			impact: "The current session can now list and invoke tools from that engine group.",
			completedWork: [
				"Loaded the project-local MCP context",
				`Loaded deferred engine group ${engine}`,
			],
			blockedCapabilities: [],
			nextAction: "Run `mimirmesh mcp list-tools` or invoke one of the newly visible tools.",
			evidence: [
				{ label: "Session", value: surface.sessionId },
				{ label: "Tool count", value: String(surface.toolCount) },
			],
			machineReadablePayload: {
				sessionId: surface.sessionId,
				policyVersion: surface.policyVersion,
				loadedEngineGroups: surface.loadedEngineGroups,
				deferredEngineGroups: surface.deferredEngineGroups,
				toolCount: surface.toolCount,
				diagnostics: surface.diagnostics,
			},
		};
	},
});

export const createMcpToolSchemaWorkflow = (
	toolName: string,
	view: "compressed" | "full" | "debug",
): WorkflowDefinition => ({
	id: "mcp-tool-schema",
	title: `Inspect MCP Tool Schema (${toolName})`,
	description: "Inspect compressed or full schema detail for a visible MCP tool.",
	category: "mcp",
	entryModes: ["tui-embedded", "direct-command"],
	interactivePolicy: "default-non-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["mcp-tool", "mcp-list-tools"],
	steps: [
		{ id: "load-context", label: "Load MCP context", kind: "validation" },
		{ id: "inspect-schema", label: "Inspect tool schema", kind: "discovery" },
	],
	execute: async ({ controller }) => {
		controller.startStep("load-context", "Loading project-local MCP context.");
		const context = await loadCliContext();
		controller.completeStep("load-context", {
			evidence: [
				{ label: "Project root", value: context.projectRoot },
				{ label: "Session", value: context.sessionId },
			],
		});

		controller.startStep("inspect-schema", `Inspecting ${toolName} with ${view} detail.`);
		const schema = await mcpInspectToolSchema(context, toolName, view);
		controller.completeStep("inspect-schema", {
			evidence: [
				{ label: "Tool", value: toolName },
				{ label: "Detail", value: view },
				{ label: "Engine", value: schema.resolvedEngine },
			],
		});

		return {
			kind: "success",
			message: `Inspected ${toolName} schema.`,
			impact: "The current session can compare compressed metadata with fuller schema detail.",
			completedWork: ["Loaded the project-local MCP context", `Inspected ${toolName} schema`],
			blockedCapabilities: [],
			nextAction: "Run `mimirmesh mcp tool <name>` once the schema looks correct.",
			evidence: [
				{ label: "Tool", value: toolName },
				{ label: "Engine", value: schema.resolvedEngine },
			],
			machineReadablePayload: schema,
		};
	},
});

export const createMcpToolWorkflow = (
	toolName: string,
	input: Record<string, unknown>,
): WorkflowDefinition => ({
	id: "mcp-tool",
	title: `Invoke MCP Tool (${toolName})`,
	description:
		"Run a unified or passthrough MCP tool and preserve the same outcome semantics in human and machine-readable modes.",
	category: "mcp",
	entryModes: ["tui-embedded", "direct-command"],
	interactivePolicy: "default-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["mcp-list-tools", "runtime-status"],
	steps: [
		{ id: "load-context", label: "Load MCP context", kind: "validation" },
		{ id: "invoke-tool", label: "Invoke selected MCP tool", kind: "runtime-action" },
	],
	execute: async ({ controller }) => {
		controller.startStep("load-context", "Loading project-local config and router.");
		const context = await loadCliContext();
		controller.completeStep("load-context", {
			evidence: [
				{ label: "Project root", value: context.projectRoot },
				{ label: "Session", value: context.sessionId },
			],
		});

		controller.startStep("invoke-tool", `Calling ${toolName} through the shared router.`);
		const result = await mcpCallTool(context, toolName, input);
		const evidence = [
			{ label: "Success", value: String(result.success) },
			{ label: "Items", value: String(result.items.length) },
			{ label: "Warnings", value: String(result.warnings.length) },
		];
		if (result.success && !result.degraded) {
			controller.completeStep("invoke-tool", {
				summary: result.message,
				evidence,
			});
		} else if (result.success) {
			controller.degradeStep("invoke-tool", {
				summary: result.message,
				evidence,
			});
		} else {
			controller.failStep("invoke-tool", {
				summary: result.message,
				evidence,
			});
		}
		result.warnings.forEach((warning, index) => {
			controller.addWarning({
				id: `mcp-tool-${index}`,
				label: "Tool warning",
				message: warning,
			});
		});
		const runtime =
			!result.success || result.degraded ? await runtimeAction(context, "status") : null;
		const nextAction =
			result.nextAction ??
			(result.warningCodes.includes("runtime_restart_required") ||
			result.warningCodes.includes("bridge_unhealthy")
				? "Run `mimirmesh runtime restart --non-interactive` and retry the MCP tool."
				: result.warningCodes.includes("mcp_server_stale")
					? "Restart the IDE MCP session or reconnect the client so it picks up the latest MCP server build."
					: runtime?.upgradeStatus?.requiredActions.includes("restart-runtime")
						? "Run `mimirmesh runtime restart --non-interactive` and retry the MCP tool."
						: result.success
							? "Inspect the returned items or rerun the tool with adjusted input."
							: "Review the tool message and runtime warnings before retrying.");

		return {
			kind: result.success ? (result.degraded ? "degraded" : "success") : "failed",
			message: result.message,
			impact: result.success
				? result.degraded
					? "Tool execution returned usable output, but warnings indicate degraded behavior."
					: "Tool execution completed successfully."
				: "Tool execution did not complete successfully.",
			completedWork: ["Loaded the project-local router", `Invoked ${toolName}`],
			blockedCapabilities: result.success ? [] : [`Successful execution of ${toolName}`],
			nextAction,
			evidence: [
				...evidence,
				...result.items.slice(0, 6).map((item, index) => ({
					label: `Item ${index + 1}`,
					value: `${item.title}: ${item.content}`,
				})),
			],
			machineReadablePayload: {
				...result,
				runtime,
			},
		};
	},
});
