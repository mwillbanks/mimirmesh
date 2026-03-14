import { Box, Text } from "ink";

import type { PresentationProfile } from "../workflow/types";

type BrandMarkProps = {
	compact?: boolean;
	colorSupport: PresentationProfile["colorSupport"];
};

const colorIfAvailable = (
	colorSupport: PresentationProfile["colorSupport"],
	richColor: string,
	basicColor: string,
): string | undefined => {
	if (colorSupport === "none") {
		return undefined;
	}

	return colorSupport === "rich" ? richColor : basicColor;
};

export const BrandMark = ({ compact = false, colorSupport }: BrandMarkProps) => {
	const slateColor = colorIfAvailable(colorSupport, "#94A3B8", "gray");
	const indigoColor = colorIfAvailable(colorSupport, "#4F46E5", "blue");
	const purpleColor = colorIfAvailable(colorSupport, "#7C3AED", "magenta");
	const cyanColor = colorIfAvailable(colorSupport, "#0891B2", "cyan");
	const centerColor = colorIfAvailable(colorSupport, "#E2E8F0", "white");

	if (compact) {
		return (
			<Box flexDirection="column">
				<Text>
					{"  "}
					<Text color={slateColor}>o</Text>
				</Text>
				<Text>
					<Text color={indigoColor}>o</Text>-<Text color={centerColor}>O</Text>-
					<Text color={purpleColor}>o</Text>
				</Text>
				<Text>
					{"  "}
					<Text color={cyanColor}>o</Text>
				</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Text>
				{"    "}
				<Text color={slateColor}>o</Text>
			</Text>
			<Text>
				{"  "}
				<Text color={slateColor}>o</Text>/|\<Text color={indigoColor}>o</Text>
			</Text>
			<Text>
				<Text color={indigoColor}>o</Text>-- <Text color={centerColor}>O</Text> --
				<Text color={purpleColor}>o</Text>
			</Text>
			<Text>
				{"  "}
				<Text color={purpleColor}>o</Text>\|/<Text color={cyanColor}>o</Text>
			</Text>
			<Text>
				{"    "}
				<Text color={cyanColor}>o</Text>
			</Text>
		</Box>
	);
};
