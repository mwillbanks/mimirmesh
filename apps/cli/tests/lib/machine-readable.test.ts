import { describe, expect, test } from "bun:test";

import type { WorkflowDefinition, WorkflowRunState } from "@mimirmesh/ui";

import { serializeWorkflowRun } from "../../src/lib/machine-readable";

const definition: WorkflowDefinition = {
	id: "machine-readable-test",
	title: "Machine Readable Test",
	description: "Verify JSON parity for workflow output.",
	category: "runtime",
	entryModes: ["direct-command"],
	interactivePolicy: "default-non-interactive",
	machineReadableSupported: true,
	requiresProjectContext: false,
	recommendedNextActions: [],
	steps: [{ id: "inspect", label: "Inspect runtime", kind: "discovery" }],
	execute: async () => ({
		kind: "success",
		message: "unused",
		impact: "unused",
		completedWork: [],
		blockedCapabilities: [],
		nextAction: "unused",
	}),
};

describe("serializeWorkflowRun", () => {
	test("preserves terminal outcome, evidence, warnings, and step state", () => {
		const state: WorkflowRunState = {
			workflowId: definition.id,
			phase: "degraded",
			activeStepId: null,
			completedStepIds: ["inspect"],
			warnings: [{ id: "runtime", label: "Runtime", message: "Docker daemon is unavailable." }],
			details: [{ label: "Project root", value: "/tmp/demo" }],
			startedAt: "2026-03-13T00:00:00.000Z",
			completedAt: "2026-03-13T00:00:05.000Z",
			steps: [
				{
					id: "inspect",
					label: "Inspect runtime",
					kind: "discovery",
					status: "degraded",
					summary: "Runtime is degraded.",
					evidence: [{ label: "Runtime state", value: "degraded" }],
				},
			],
			promptSession: null,
			outcome: {
				kind: "degraded",
				message: "Runtime is degraded.",
				impact: "Live runtime workflows remain limited.",
				completedWork: ["Inspect runtime"],
				blockedCapabilities: ["Live runtime control"],
				nextAction: "Repair the runtime and rerun the command.",
				evidence: [{ label: "Runtime state", value: "degraded" }],
				machineReadablePayload: { runtime: "degraded" },
			},
		};

		const serialized = serializeWorkflowRun(definition, state);
		expect(serialized.workflowId).toBe(definition.id);
		expect(serialized.phase).toBe("degraded");
		expect(serialized.completedStepIds).toEqual(["inspect"]);
		expect(serialized.warnings).toEqual([
			{ id: "runtime", label: "Runtime", message: "Docker daemon is unavailable." },
		]);
		expect(serialized.steps).toEqual([
			{
				id: "inspect",
				label: "Inspect runtime",
				kind: "discovery",
				status: "degraded",
				summary: "Runtime is degraded.",
				evidence: [{ label: "Runtime state", value: "degraded" }],
			},
		]);
		expect(serialized.outcome).toEqual({
			kind: "degraded",
			message: "Runtime is degraded.",
			impact: "Live runtime workflows remain limited.",
			completedWork: ["Inspect runtime"],
			blockedCapabilities: ["Live runtime control"],
			nextAction: "Repair the runtime and rerun the command.",
			evidence: [{ label: "Runtime state", value: "degraded" }],
			payload: { runtime: "degraded" },
		});
	});
});
