import type { WorkflowDefinition } from "@mimirmesh/ui";

import { loadCliContext, mcpCallTool, mcpListTools, runtimeAction } from "../lib/context";

export const createMcpListToolsWorkflow = (): WorkflowDefinition => ({
	id: "mcp-list-tools",
	title: "Inspect MCP Tools",
	description: "List unified and passthrough MCP tools using live project-local routing state.",
	category: "mcp",
	entryModes: ["tui-embedded", "direct-command"],
	interactivePolicy: "default-non-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["mcp-tool", "runtime-status"],
	steps: [
		{ id: "load-context", label: "Load MCP context", kind: "validation" },
		{
			id: "inspect-runtime",
			label: "Check runtime readiness for passthrough tools",
			kind: "discovery",
		},
		{ id: "list-tools", label: "List available MCP tools", kind: "discovery" },
	],
	execute: async ({ controller }) => {
		controller.startStep("load-context", "Loading project-local config and router.");
		const context = await loadCliContext();
		controller.completeStep("load-context", {
			evidence: [{ label: "Project root", value: context.projectRoot }],
		});

		controller.startStep(
			"inspect-runtime",
			"Checking whether runtime-backed passthrough tools are currently ready.",
		);
		const runtime = await runtimeAction(context, "status");
		const runtimeEvidence = [
			{ label: "Runtime state", value: runtime.health.state },
			{ label: "Runtime message", value: runtime.message },
		];
		if (runtime.health.state === "ready") {
			controller.completeStep("inspect-runtime", {
				evidence: runtimeEvidence,
			});
		} else {
			controller.degradeStep("inspect-runtime", {
				summary: "Runtime-backed passthrough discovery is not fully ready.",
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

		controller.startStep("list-tools", "Listing unified tools and any live passthrough routes.");
		const tools = await mcpListTools(context);
		controller.completeStep("list-tools", {
			evidence: [
				{ label: "Total tools", value: String(tools.length) },
				{
					label: "Passthrough tools",
					value: String(tools.filter((tool) => tool.type === "passthrough").length),
				},
			],
		});

		const degraded = runtime.health.state !== "ready";

		return {
			kind: degraded ? "degraded" : "success",
			message: degraded
				? `Discovered ${tools.length} MCP tools, but runtime-backed passthrough coverage is degraded.`
				: `Discovered ${tools.length} MCP tools.`,
			impact: degraded
				? "Unified tools are available, but some passthrough routes may be unavailable until runtime health improves."
				: "Unified and passthrough MCP inspection surfaces are available.",
			completedWork: [
				"Loaded the project-local router",
				"Checked runtime readiness for passthrough routes",
				"Listed the available MCP tools",
			],
			blockedCapabilities: degraded ? ["Healthy passthrough MCP inspection"] : [],
			nextAction: degraded
				? runtime.upgradeStatus?.requiredActions.includes("restart-runtime")
					? "Run `mimirmesh runtime restart --non-interactive` before relying on passthrough tools."
					: "Run `mimirmesh runtime status` and address the runtime warnings before relying on passthrough tools."
				: "Run `mimirmesh mcp tool <name>` to inspect a specific tool.",
			evidence: [
				{ label: "Tool count", value: String(tools.length) },
				{
					label: "Passthrough count",
					value: String(tools.filter((tool) => tool.type === "passthrough").length),
				},
				...tools.slice(0, 10).map((tool, index) => ({
					label: `Tool ${index + 1}`,
					value: `${tool.name}${tool.description ? ` - ${tool.description}` : ""}`,
				})),
			],
			machineReadablePayload: {
				runtime,
				tools,
			},
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
			evidence: [{ label: "Project root", value: context.projectRoot }],
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
