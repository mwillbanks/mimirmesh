import type { WorkflowDefinition, WorkflowRunState, WorkflowTerminalOutcome } from "@mimirmesh/ui";

const serializeOutcome = (outcome: WorkflowTerminalOutcome | null) =>
	outcome
		? {
				kind: outcome.kind,
				message: outcome.message,
				impact: outcome.impact,
				completedWork: outcome.completedWork,
				blockedCapabilities: outcome.blockedCapabilities,
				nextAction: outcome.nextAction,
				evidence: outcome.evidence ?? [],
				payload: outcome.machineReadablePayload ?? {},
			}
		: null;

export const serializeWorkflowRun = (
	definition: WorkflowDefinition,
	state: WorkflowRunState,
): Record<string, unknown> => ({
	workflowId: definition.id,
	title: definition.title,
	phase: state.phase,
	activeStepId: state.activeStepId,
	completedStepIds: state.completedStepIds,
	warnings: state.warnings.map((warning) => ({
		id: warning.id,
		label: warning.label,
		message: warning.message,
	})),
	details: state.details,
	steps: state.steps.map((step) => ({
		id: step.id,
		label: step.label,
		kind: step.kind,
		status: step.status,
		summary: step.summary ?? "",
		evidence: step.evidence ?? [],
	})),
	outcome: serializeOutcome(state.outcome),
	startedAt: state.startedAt,
	completedAt: state.completedAt,
});
