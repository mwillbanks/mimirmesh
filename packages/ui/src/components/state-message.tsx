import { StatusMessage } from "@inkjs/ui";
import type React from "react";

type StateMessageProps = {
	variant: "success" | "error" | "warning" | "info";
	children: React.ReactNode;
};

export const StateMessage = ({ variant, children }: StateMessageProps) => (
	<StatusMessage variant={variant}>{children}</StatusMessage>
);
