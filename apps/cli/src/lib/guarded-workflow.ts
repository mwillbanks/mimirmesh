import type { WorkflowDefinition } from "@mimirmesh/ui";

export const createGuardedWorkflow = (
	definition: WorkflowDefinition,
	message: string,
	impact: string,
	blockedCapabilities: string[],
	nextAction: string,
): WorkflowDefinition => ({
	...definition,
	execute: async () => ({
		kind: "failed",
		message,
		impact,
		completedWork: [],
		blockedCapabilities,
		nextAction,
	}),
});
