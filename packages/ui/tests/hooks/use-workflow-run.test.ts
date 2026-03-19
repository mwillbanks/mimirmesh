import { describe, expect, test } from "bun:test";
import {
	applyWorkflowEvent,
	createInitialWorkflowRunState,
	executeWorkflowRun,
} from "../../src/hooks/use-workflow-run";
import type { PresentationProfile, WorkflowDefinition } from "../../src/workflow/types";

const presentation: PresentationProfile = {
	mode: "direct-human",
	interactive: false,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "standard",
};

const definition: WorkflowDefinition = {
	id: "workflow-run-test",
	title: "Workflow Run Test",
	description: "Exercise the shared workflow execution state machine.",
	category: "setup",
	entryModes: ["direct-command"],
	interactivePolicy: "default-non-interactive",
	machineReadableSupported: true,
	requiresProjectContext: false,
	recommendedNextActions: [],
	steps: [
		{ id: "load-context", label: "Load context", kind: "validation" },
		{ id: "verify-state", label: "Verify state", kind: "discovery" },
	],
	execute: async ({ controller }) => {
		controller.startStep("load-context", "Loading the project context.");
		controller.completeStep("load-context", {
			summary: "Context loaded.",
			evidence: [{ label: "Project root", value: "/tmp/demo" }],
		});
		controller.startStep("verify-state", "Checking live readiness.");
		controller.degradeStep("verify-state", {
			summary: "Verification completed with a warning.",
			evidence: [{ label: "Runtime", value: "degraded" }],
		});
		controller.addWarning({
			id: "runtime-warning",
			label: "Runtime",
			message: "Docker daemon is unavailable.",
		});

		return {
			kind: "degraded",
			message: "Workflow completed with follow-up work required.",
			impact: "The requested workflow ran, but one or more capabilities remain limited.",
			completedWork: [],
			blockedCapabilities: ["Live runtime control"],
			nextAction: "Start Docker and rerun the workflow.",
		};
	},
};

describe("useWorkflowRun helpers", () => {
	test("applies step, warning, and terminal outcome events with normalized completed work", () => {
		let state = createInitialWorkflowRunState(definition);
		state = applyWorkflowEvent(state, {
			type: "step:start",
			stepId: "load-context",
			summary: "Loading the project context.",
		});
		state = applyWorkflowEvent(state, {
			type: "step:update",
			stepId: "load-context",
			status: "completed",
			summary: "Context loaded.",
			evidence: [{ label: "Project root", value: "/tmp/demo" }],
		});
		state = applyWorkflowEvent(state, {
			type: "warning:add",
			warning: {
				id: "runtime-warning",
				label: "Runtime",
				message: "Docker daemon is unavailable.",
			},
		});
		state = applyWorkflowEvent(state, {
			type: "finish",
			outcome: {
				kind: "degraded",
				message: "Workflow completed with follow-up work required.",
				impact: "The requested workflow ran, but one or more capabilities remain limited.",
				completedWork: [],
				blockedCapabilities: ["Live runtime control"],
				nextAction: "Start Docker and rerun the workflow.",
			},
		});

		expect(state.phase).toBe("degraded");
		expect(state.completedStepIds).toEqual(["load-context"]);
		expect(state.outcome?.completedWork).toEqual(["Load context"]);
		expect(state.outcome?.blockedCapabilities).toEqual(["Live runtime control"]);
		expect(state.warnings).toHaveLength(1);
		expect(state.steps.find((step) => step.id === "load-context")?.status).toBe("completed");
	});

	test("executes a workflow definition and captures degraded warnings and failed exceptions", async () => {
		const transitions: string[] = [];
		const finalState = await executeWorkflowRun(definition, presentation, (state) => {
			transitions.push(state.phase);
		});

		expect(transitions[0]).toBe("idle");
		expect(transitions).toContain("running");
		expect(finalState.phase).toBe("degraded");
		expect(finalState.warnings[0]?.message).toContain("Docker daemon");
		expect(finalState.outcome?.completedWork).toContain("Load context");

		const failed = await executeWorkflowRun(
			{
				...definition,
				id: "workflow-run-test-failure",
				execute: async () => {
					throw new Error("boom");
				},
			},
			presentation,
		);

		expect(failed.phase).toBe("failed");
		expect(failed.outcome?.message).toContain("boom");
		expect(failed.outcome?.blockedCapabilities).toEqual(["Requested workflow"]);
	});
});
