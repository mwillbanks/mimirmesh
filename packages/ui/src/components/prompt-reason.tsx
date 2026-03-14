import { Box, Text } from "ink";

import { StateMessage } from "./state-message";

type PromptReasonProps = {
	title: string;
	reason: string;
	consequence: string;
	nonInteractiveFallback: string;
};

export const PromptReason = ({
	title,
	reason,
	consequence,
	nonInteractiveFallback,
}: PromptReasonProps) => (
	<Box flexDirection="column" gap={1}>
		<Text bold>{title}</Text>
		<StateMessage variant="info">[DECISION REQUIRED] {reason}</StateMessage>
		<Text>
			<Text bold>Consequence:</Text> {consequence}
		</Text>
		<Text>
			<Text bold>Automation:</Text> {nonInteractiveFallback}
		</Text>
	</Box>
);
