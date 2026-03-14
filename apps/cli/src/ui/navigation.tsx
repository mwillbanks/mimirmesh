import { Box, Text } from "ink";

export type NavigationItem = {
	id: string;
	title: string;
	statusSummary: string;
};

type NavigationProps = {
	items: NavigationItem[];
	activeId: string;
};

export const Navigation = ({ items, activeId }: NavigationProps) => (
	<Box flexDirection="column" gap={1}>
		<Text bold>Sections</Text>
		{items.map((item) => {
			const active = item.id === activeId;
			return (
				<Box key={item.id} flexDirection="column">
					<Text bold={active}>
						{active ? "[>]" : "[ ]"} {item.title}
					</Text>
					<Text>{item.statusSummary}</Text>
				</Box>
			);
		})}
	</Box>
);
