import { Box, Text } from "ink";

import type { WorkflowStep } from "../workflow/types";
import { SpinnerLine } from "./spinner-line";

type WorkflowStepListProps = {
	steps: WorkflowStep[];
	reducedMotion?: boolean;
};

const tokenByStatus: Record<WorkflowStep["status"], string> = {
	pending: "[ ]",
	running: "[>]",
	completed: "[x]",
	degraded: "[!]",
	failed: "[x]",
	skipped: "[-]",
};

const labelByStatus: Record<WorkflowStep["status"], string> = {
	pending: "pending",
	running: "running",
	completed: "completed",
	degraded: "degraded",
	failed: "failed",
	skipped: "skipped",
};

export const WorkflowStepList = ({ steps, reducedMotion = false }: WorkflowStepListProps) => (
	<Box flexDirection="column" gap={1}>
		<Text bold>Workflow progress</Text>
		{steps.map((step) => (
			<Box key={step.id} flexDirection="column">
				{step.status === "running" ? (
					<SpinnerLine
						label={`${tokenByStatus[step.status]} ${step.label} (${labelByStatus[step.status]})`}
						reducedMotion={reducedMotion}
					/>
				) : (
					<Text>
						{tokenByStatus[step.status]} {step.label} ({labelByStatus[step.status]})
					</Text>
				)}
				{step.summary ? (
					<Box paddingLeft={4}>
						<Text>{step.summary}</Text>
					</Box>
				) : null}
				{step.evidence?.map((row) => (
					<Box key={`${step.id}-${row.label}`} paddingLeft={4}>
						<Text>
							{row.label}: {row.value}
						</Text>
					</Box>
				))}
			</Box>
		))}
	</Box>
);
