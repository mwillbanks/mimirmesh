import { Box, Text } from "ink";
import type React from "react";

import type { PresentationProfile } from "../workflow/types";
import { BrandMark } from "./brand-mark";

type ShellFrameProps = {
	title: string;
	subtitle: string;
	presentation: PresentationProfile;
	sidebar?: React.ReactNode;
	footer?: React.ReactNode;
	statusLine?: React.ReactNode;
	children: React.ReactNode;
};

const brand = "MIMIRMESH";

export const ShellFrame = ({
	title,
	subtitle,
	presentation,
	sidebar,
	footer,
	statusLine,
	children,
}: ShellFrameProps) => {
	const compact = presentation.terminalSizeClass === "compact";

	return (
		<Box flexDirection="column" width="100%" padding={compact ? 0 : 1} gap={1}>
			<Box
				borderStyle="round"
				paddingX={1}
				paddingY={0}
				flexDirection="column"
				marginBottom={compact ? 0 : 0}
			>
				<Box flexDirection={compact ? "column" : "row"} gap={compact ? 0 : 2}>
					<BrandMark compact={compact} colorSupport={presentation.colorSupport} />
					<Box flexDirection="column">
						<Text bold color={presentation.colorSupport === "none" ? undefined : "cyan"}>
							{brand}
						</Text>
						<Text bold>{title}</Text>
						<Text>{subtitle}</Text>
					</Box>
				</Box>
				{statusLine ? <Box marginTop={1}>{statusLine}</Box> : null}
			</Box>

			<Box flexDirection={compact ? "column" : "row"} gap={1}>
				{sidebar ? (
					<Box
						borderStyle="round"
						padding={compact ? 0 : 1}
						width={compact ? undefined : 32}
						minWidth={compact ? undefined : 32}
						flexDirection="column"
					>
						{sidebar}
					</Box>
				) : null}

				<Box borderStyle="round" padding={compact ? 0 : 1} flexGrow={1} flexDirection="column">
					{children}
				</Box>
			</Box>

			<Box borderStyle="round" paddingX={compact ? 0 : 1}>
				{footer ?? (
					<Text>
						Keyboard: use arrow keys to move, Enter to select, Tab to switch panes, Escape to go
						back.
					</Text>
				)}
			</Box>
		</Box>
	);
};
