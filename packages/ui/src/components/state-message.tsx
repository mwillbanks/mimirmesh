import { Box, Text } from "ink";
import type React from "react";

type StateMessageProps = {
	variant: "success" | "degraded" | "failed" | "error" | "warning" | "info";
	children: React.ReactNode;
};

const variantConfig: Record<StateMessageProps["variant"], { label: string; color?: string }> = {
	success: { label: "[SUCCESS]", color: "green" },
	degraded: { label: "[DEGRADED]", color: "yellow" },
	failed: { label: "[FAILED]", color: "red" },
	error: { label: "[FAILED]", color: "red" },
	warning: { label: "[WARNING]", color: "yellow" },
	info: { label: "[INFO]", color: "cyan" },
};

export const StateMessage = ({ variant, children }: StateMessageProps) => {
	const config = variantConfig[variant];

	return (
		<Box>
			<Text bold color={config.color}>
				{config.label}
			</Text>
			<Text> {children}</Text>
		</Box>
	);
};
