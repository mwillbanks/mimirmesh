import type {
	WorkflowCategory,
	WorkflowDefinition,
	WorkflowStepKind,
	WorkflowTerminalOutcome,
} from "@mimirmesh/ui";

import { loadCliContext } from "./context";

type ContextWorkflowResult = {
	kind: WorkflowTerminalOutcome["kind"];
	message: string;
	impact: string;
	nextAction: string;
	completedWork?: string[];
	blockedCapabilities?: string[];
	evidence?: Array<{ label: string; value: string }>;
	machineReadablePayload?: Record<string, unknown> | string[] | string | unknown;
	warnings?: string[];
	stepSummary?: string;
};

type ContextWorkflowConfig = {
	id: string;
	title: string;
	description: string;
	category: WorkflowCategory;
	interactivePolicy: WorkflowDefinition["interactivePolicy"];
	recommendedNextActions: string[];
	stepLabel: string;
	stepKind: WorkflowStepKind;
	machineReadableSupported?: boolean;
	loadContext?: typeof loadCliContext;
	run: (context: Awaited<ReturnType<typeof loadCliContext>>) => Promise<ContextWorkflowResult>;
};

export const createContextWorkflow = ({
	id,
	title,
	description,
	category,
	interactivePolicy,
	recommendedNextActions,
	stepLabel,
	stepKind,
	machineReadableSupported = true,
	loadContext = loadCliContext,
	run,
}: ContextWorkflowConfig): WorkflowDefinition => ({
	id,
	title,
	description,
	category,
	entryModes: ["direct-command"],
	interactivePolicy,
	machineReadableSupported,
	requiresProjectContext: true,
	recommendedNextActions,
	steps: [
		{ id: "load-context", label: "Load project context", kind: "validation" },
		{ id: "execute", label: stepLabel, kind: stepKind },
	],
	execute: async ({ controller }) => {
		controller.startStep(
			"load-context",
			"Loading project-local config, logger, and runtime paths.",
		);
		const context = await loadContext();
		controller.completeStep("load-context", {
			evidence: [{ label: "Project root", value: context.projectRoot }],
		});

		controller.startStep("execute", `Running: ${stepLabel}.`);
		const result = await run(context);
		if (result.kind === "success") {
			controller.completeStep("execute", {
				summary: result.stepSummary ?? result.message,
				evidence: result.evidence,
			});
		} else if (result.kind === "degraded") {
			controller.degradeStep("execute", {
				summary: result.stepSummary ?? result.message,
				evidence: result.evidence,
			});
		} else {
			controller.failStep("execute", {
				summary: result.stepSummary ?? result.message,
				evidence: result.evidence,
			});
		}
		result.warnings?.forEach((warning, index) => {
			controller.addWarning({
				id: `${id}-warning-${index}`,
				label: title,
				message: warning,
			});
		});

		return {
			kind: result.kind,
			message: result.message,
			impact: result.impact,
			completedWork: result.completedWork ?? [stepLabel],
			blockedCapabilities: result.blockedCapabilities ?? [],
			nextAction: result.nextAction,
			evidence: result.evidence,
			machineReadablePayload:
				typeof result.machineReadablePayload === "object" && result.machineReadablePayload !== null
					? (result.machineReadablePayload as Record<string, unknown>)
					: { value: result.machineReadablePayload },
		};
	},
});
