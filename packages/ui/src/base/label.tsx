import { Box, Text } from "ink";

type LabelProps = {
	name: string;
	value: string;
};

export const Label = ({ name, value }: LabelProps) => (
	<Box flexDirection="row">
		<Text bold>{name}:</Text>
		<Text> {value}</Text>
	</Box>
);
