import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
	PresentationProfile,
	PromptSession,
	TerminalOutcome,
	WorkflowController,
	WorkflowDefinition,
	WorkflowEvidenceRow,
	WorkflowRunState,
	WorkflowStep,
	WorkflowStepStatus,
	WorkflowWarning,
} from "../workflow/types";

type WorkflowEvent =
	| { type: "step:start"; stepId: string; summary?: string }
	| {
			type: "step:update";
			stepId: string;
			status: WorkflowStepStatus;
			summary?: string;
			evidence?: WorkflowEvidenceRow[];
	  }
	| { type: "warning:add"; warning: WorkflowWarning }
	| { type: "detail:add"; detail: WorkflowEvidenceRow }
	| { type: "prompt:set"; prompt: PromptSession | null }
	| { type: "finish"; outcome: TerminalOutcome }
	| { type: "cancel" };

const now = (): string => new Date().toISOString();

const withSummary = (step: WorkflowStep, summary?: string, evidence?: WorkflowEvidenceRow[]) => ({
	...step,
	summary: summary ?? step.summary,
	evidence: evidence ?? step.evidence,
});

const ensureCompleted = (completed: string[], stepId: string): string[] =>
	completed.includes(stepId) ? completed : [...completed, stepId];

const updateSteps = (
	steps: WorkflowStep[],
	stepId: string,
	update: (step: WorkflowStep) => WorkflowStep,
): WorkflowStep[] => steps.map((step) => (step.id === stepId ? update(step) : step));

const stepLabel = (steps: WorkflowStep[], stepId: string): string =>
	steps.find((step) => step.id === stepId)?.label ?? stepId;

export const createInitialWorkflowRunState = (
	definition: WorkflowDefinition,
): WorkflowRunState => ({
	workflowId: definition.id,
	phase: "idle",
	activeStepId: null,
	completedStepIds: [],
	warnings: [],
	details: [],
	startedAt: now(),
	completedAt: null,
	steps: definition.steps.map((step) => ({
		...step,
		status: "pending",
		summary: step.summary,
	})),
	promptSession: null,
	outcome: null,
});

const normalizeCompletedWork = (
	state: WorkflowRunState,
	outcome: TerminalOutcome,
): TerminalOutcome => ({
	...outcome,
	completedWork:
		outcome.completedWork.length > 0
			? outcome.completedWork
			: state.completedStepIds.map((stepId) => stepLabel(state.steps, stepId)),
	blockedCapabilities: outcome.blockedCapabilities ?? [],
});

const normalizeActiveStepForFinish = (
	state: WorkflowRunState,
	outcome: TerminalOutcome,
): WorkflowRunState => {
	if (!state.activeStepId) {
		return state;
	}

	const runningStep = state.steps.find((step) => step.id === state.activeStepId);
	if (!runningStep || runningStep.status !== "running") {
		return state;
	}

	const status =
		outcome.kind === "failed" ? "failed" : outcome.kind === "degraded" ? "degraded" : "completed";
	return {
		...state,
		completedStepIds:
			status === "completed" || status === "degraded"
				? ensureCompleted(state.completedStepIds, state.activeStepId)
				: state.completedStepIds,
		steps: updateSteps(state.steps, state.activeStepId, (step) =>
			withSummary(step, step.summary, step.evidence ? [...step.evidence] : undefined),
		).map((step) =>
			step.id === state.activeStepId
				? {
						...step,
						status,
					}
				: step,
		),
	};
};

export const applyWorkflowEvent = (
	state: WorkflowRunState,
	event: WorkflowEvent,
): WorkflowRunState => {
	switch (event.type) {
		case "step:start":
			return {
				...state,
				phase: "running",
				activeStepId: event.stepId,
				promptSession: null,
				steps: updateSteps(state.steps, event.stepId, (step) => ({
					...withSummary(step, event.summary),
					status: "running",
				})),
			};

		case "step:update": {
			const completed =
				event.status === "completed" || event.status === "degraded"
					? ensureCompleted(state.completedStepIds, event.stepId)
					: state.completedStepIds;

			return {
				...state,
				activeStepId:
					state.activeStepId === event.stepId && event.status !== "running"
						? null
						: state.activeStepId,
				steps: updateSteps(state.steps, event.stepId, (step) => ({
					...withSummary(step, event.summary, event.evidence),
					status: event.status,
				})),
				completedStepIds: completed,
			};
		}

		case "warning:add":
			return {
				...state,
				warnings: state.warnings.some((warning) => warning.id === event.warning.id)
					? state.warnings
					: [...state.warnings, event.warning],
			};

		case "detail:add":
			return {
				...state,
				details: [...state.details, event.detail],
			};

		case "prompt:set":
			return {
				...state,
				phase: event.prompt
					? "awaiting-input"
					: state.phase === "awaiting-input"
						? "idle"
						: state.phase,
				promptSession: event.prompt,
			};

		case "finish": {
			const withFinishedStep = normalizeActiveStepForFinish(state, event.outcome);
			const normalizedOutcome = normalizeCompletedWork(withFinishedStep, event.outcome);
			return {
				...withFinishedStep,
				phase: normalizedOutcome.kind,
				activeStepId: null,
				completedAt: now(),
				promptSession: null,
				outcome: normalizedOutcome,
			};
		}

		case "cancel":
			return {
				...state,
				phase: "cancelled",
				activeStepId: null,
				completedAt: now(),
			};
	}
};

const unexpectedFailureOutcome = (state: WorkflowRunState, error: unknown): TerminalOutcome => ({
	kind: "failed",
	message: error instanceof Error ? error.message : String(error),
	impact: "The workflow did not complete, so the requested capability remains unavailable.",
	completedWork: state.completedStepIds.map((stepId) => stepLabel(state.steps, stepId)),
	blockedCapabilities: ["Requested workflow"],
	nextAction: "Review the error output and retry the workflow once the blocking issue is fixed.",
	machineReadablePayload: {
		error: error instanceof Error ? error.message : String(error),
	},
});

const createController = (dispatch: (event: WorkflowEvent) => void): WorkflowController => ({
	startStep: (stepId, summary) => {
		dispatch({ type: "step:start", stepId, summary });
	},
	completeStep: (stepId, options) => {
		dispatch({ type: "step:update", stepId, status: "completed", ...options });
	},
	degradeStep: (stepId, options) => {
		dispatch({ type: "step:update", stepId, status: "degraded", ...options });
	},
	failStep: (stepId, options) => {
		dispatch({ type: "step:update", stepId, status: "failed", ...options });
	},
	skipStep: (stepId, summary) => {
		dispatch({ type: "step:update", stepId, status: "skipped", summary });
	},
	addWarning: (warning) => {
		dispatch({ type: "warning:add", warning });
	},
	addDetail: (detail) => {
		dispatch({ type: "detail:add", detail });
	},
	setPrompt: (prompt) => {
		dispatch({ type: "prompt:set", prompt });
	},
});

export const executeWorkflowRun = async (
	definition: WorkflowDefinition,
	presentation: PresentationProfile,
	onStateChange?: (state: WorkflowRunState) => void,
): Promise<WorkflowRunState> => {
	let state = createInitialWorkflowRunState(definition);
	const dispatch = (event: WorkflowEvent) => {
		state = applyWorkflowEvent(state, event);
		onStateChange?.(state);
	};

	onStateChange?.(state);

	try {
		const outcome = await definition.execute({
			controller: createController(dispatch),
			presentation,
		});
		dispatch({ type: "finish", outcome });
	} catch (error) {
		dispatch({
			type: "finish",
			outcome: unexpectedFailureOutcome(state, error),
		});
	}

	return state;
};

type UseWorkflowRunOptions = {
	definition: WorkflowDefinition;
	presentation: PresentationProfile;
	autoStart?: boolean;
};

export const useWorkflowRun = ({
	definition,
	presentation,
	autoStart = true,
}: UseWorkflowRunOptions) => {
	const [state, setState] = useState<WorkflowRunState>(() =>
		createInitialWorkflowRunState(definition),
	);
	const runTokenRef = useRef(0);
	const autoStartedDefinitionIdRef = useRef<string | null>(null);

	const start = useCallback(async () => {
		const token = runTokenRef.current + 1;
		runTokenRef.current = token;
		const initial = createInitialWorkflowRunState(definition);
		setState(initial);
		return executeWorkflowRun(definition, presentation, (next) => {
			if (runTokenRef.current === token) {
				setState(next);
			}
		});
	}, [definition, presentation]);

	useEffect(() => {
		if (!autoStart) {
			return;
		}
		if (autoStartedDefinitionIdRef.current === definition.id) {
			return;
		}
		autoStartedDefinitionIdRef.current = definition.id;
		void start();
	}, [autoStart, definition.id, start]);

	return useMemo(
		() => ({
			state,
			restart: start,
		}),
		[state, start],
	);
};
