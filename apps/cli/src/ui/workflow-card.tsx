import { Box, Text } from "ink";

type WorkflowCardProps = {
	title: string;
	status: string;
	description: string;
	nextAction: string;
};

export const WorkflowCard = ({ title, status, description, nextAction }: WorkflowCardProps) => (
	<Box borderStyle="round" padding={1} flexDirection="column" gap={1}>
		<Text bold>{title}</Text>
		<Text>
			<Text bold>Status:</Text> {status}
		</Text>
		<Text>{description}</Text>
		<Text>
			<Text bold>Next:</Text> {nextAction}
		</Text>
	</Box>
);
