import { ConfirmInput } from "@inkjs/ui";
import { Box, Text } from "ink";

import { PromptReason } from "./prompt-reason";

type GuidedConfirmProps = {
	title: string;
	reason: string;
	consequence: string;
	nonInteractiveFallback: string;
	defaultChoice?: "confirm" | "cancel";
	confirmText?: string;
	cancelText?: string;
	onConfirm: () => void;
	onCancel: () => void;
};

export const GuidedConfirm = ({
	title,
	reason,
	consequence,
	nonInteractiveFallback,
	defaultChoice = "confirm",
	confirmText = "Proceed",
	cancelText = "Cancel",
	onConfirm,
	onCancel,
}: GuidedConfirmProps) => (
	<Box flexDirection="column" gap={1}>
		<PromptReason
			title={title}
			reason={reason}
			consequence={consequence}
			nonInteractiveFallback={nonInteractiveFallback}
		/>
		<Text>
			Choose {confirmText} or {cancelText}.
		</Text>
		<ConfirmInput defaultChoice={defaultChoice} onConfirm={onConfirm} onCancel={onCancel} />
	</Box>
);
