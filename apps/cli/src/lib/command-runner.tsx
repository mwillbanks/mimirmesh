import {
	type PresentationProfile,
	SpinnerLine,
	StateMessage,
	TerminalOutcome,
	useWorkflowRun,
	type WorkflowDefinition,
	type WorkflowRunState,
	WorkflowStepList,
} from "@mimirmesh/ui";
import { Box, Text, useApp, useStdout } from "ink";
import { useEffect, useRef } from "react";
import { serializeWorkflowRun } from "./machine-readable";

type CommandRunnerProps = {
	definition: WorkflowDefinition;
	presentation: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

const isTerminalPhase = (phase: WorkflowRunState["phase"]): boolean =>
	phase === "success" || phase === "degraded" || phase === "failed" || phase === "cancelled";

export const CommandRunner = ({
	definition,
	presentation,
	exitOnComplete = true,
	onComplete,
}: CommandRunnerProps) => {
	const { exit } = useApp();
	const { write } = useStdout();
	const machineOutputWritten = useRef(false);
	const terminalCompletionHandled = useRef<string | null>(null);
	const { state } = useWorkflowRun({
		definition,
		presentation,
		autoStart: true,
	});

	useEffect(() => {
		if (!isTerminalPhase(state.phase)) {
			terminalCompletionHandled.current = null;
			machineOutputWritten.current = false;
			return;
		}

		const completionKey = state.completedAt ?? `${state.workflowId}:${state.phase}`;
		if (terminalCompletionHandled.current === completionKey) {
			return;
		}
		terminalCompletionHandled.current = completionKey;

		onComplete?.(state);
		if (presentation.mode === "direct-machine" && state.outcome && !machineOutputWritten.current) {
			machineOutputWritten.current = true;
			write(`${JSON.stringify(serializeWorkflowRun(definition, state), null, 2)}\n`);
		}
		if (exitOnComplete) {
			setTimeout(() => {
				exit();
			}, 0);
		}
	}, [definition, exit, exitOnComplete, onComplete, presentation.mode, state, write]);

	if (presentation.mode === "direct-machine") {
		return null;
	}

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>{definition.title}</Text>
			<Text>{definition.description}</Text>

			{state.phase === "idle" ? (
				<SpinnerLine label="Preparing workflow state" reducedMotion={presentation.reducedMotion} />
			) : null}
			{state.phase === "awaiting-input" && state.promptSession ? (
				<StateMessage variant="info">[AWAITING INPUT] {state.promptSession.reason}</StateMessage>
			) : null}
			{state.phase === "running" ? (
				<StateMessage variant="info">
					Active step:{" "}
					{state.steps.find((step) => step.id === state.activeStepId)?.label ?? "Waiting for work"}
				</StateMessage>
			) : null}

			{state.warnings.length > 0 ? (
				<Box flexDirection="column">
					<Text bold>Warnings</Text>
					{state.warnings.map((warning) => (
						<StateMessage key={warning.id} variant="warning">
							[{warning.label}] {warning.message}
						</StateMessage>
					))}
				</Box>
			) : null}

			{state.details.length > 0 ? (
				<Box flexDirection="column">
					<Text bold>Observed state</Text>
					{state.details.map((detail) => (
						<Text key={`${detail.label}-${detail.value}`}>
							{detail.label}: {detail.value}
						</Text>
					))}
				</Box>
			) : null}

			<WorkflowStepList steps={state.steps} reducedMotion={presentation.reducedMotion} />

			{state.outcome ? <TerminalOutcome outcome={state.outcome} /> : null}
		</Box>
	);
};
