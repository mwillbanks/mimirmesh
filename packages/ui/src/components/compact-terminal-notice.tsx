import { Box, Text } from "ink";

import type { PresentationProfile } from "../workflow/types";
import { BrandMark } from "./brand-mark";
import { StateMessage } from "./state-message";

type CompactTerminalNoticeProps = {
	title: string;
	reason: string;
	recommendedCommands: string[];
	colorSupport?: PresentationProfile["colorSupport"];
};

export const CompactTerminalNotice = ({
	title,
	reason,
	recommendedCommands,
	colorSupport = "none",
}: CompactTerminalNoticeProps) => (
	<Box flexDirection="column" borderStyle="round" padding={1}>
		<Box flexDirection="row" gap={1}>
			<BrandMark compact colorSupport={colorSupport} />
			<Box flexDirection="column">
				<Text bold color={colorSupport === "none" ? undefined : "cyan"}>
					MIMIRMESH
				</Text>
				<Text bold>{title}</Text>
			</Box>
		</Box>
		<StateMessage variant="warning">{reason}</StateMessage>
		<Box flexDirection="column" marginTop={1}>
			<Text bold>Recommended commands</Text>
			{recommendedCommands.map((command) => (
				<Text key={command}>- {command}</Text>
			))}
		</Box>
	</Box>
);
