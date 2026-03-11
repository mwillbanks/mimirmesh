import { Box, Text } from "ink";

import { Label } from "../base/label";
import { StateMessage } from "../components/state-message";

export type TaskState = "idle" | "running" | "success" | "warning" | "error";

type TaskStatusViewProps = {
	title: string;
	state: TaskState;
	message: string;
	details?: Array<{ label: string; value: string }>;
};

const variantByState: Record<TaskState, "success" | "error" | "warning" | "info"> = {
	idle: "info",
	running: "info",
	success: "success",
	warning: "warning",
	error: "error",
};

export const TaskStatusView = ({ title, state, message, details = [] }: TaskStatusViewProps) => (
	<Box flexDirection="column" gap={1}>
		<Text bold>{title}</Text>
		<StateMessage variant={variantByState[state]}>{message}</StateMessage>
		{details.length > 0 && (
			<Box flexDirection="column">
				{details.map((detail) => (
					<Label key={detail.label} name={detail.label} value={detail.value} />
				))}
			</Box>
		)}
	</Box>
);
