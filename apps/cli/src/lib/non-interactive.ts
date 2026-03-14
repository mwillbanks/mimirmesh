import type { PresentationProfile, WorkflowInteractivePolicy } from "@mimirmesh/ui";

type PromptPolicyOptions = {
	command: string;
	presentation: PresentationProfile;
	interactivePolicy: WorkflowInteractivePolicy;
	explicitNonInteractive?: boolean;
};

export const isInteractiveTerminal = (): boolean =>
	Boolean(process.stdout.isTTY) && Boolean(process.stdin.isTTY);

export const nonInteractiveMessage = (command: string): string =>
	`This workflow needs guidance in an interactive terminal. Re-run ${command} with --non-interactive to use the documented automation-safe path.`;

export const shouldPrompt = ({
	presentation,
	interactivePolicy,
	explicitNonInteractive = false,
}: PromptPolicyOptions): boolean =>
	interactivePolicy !== "default-non-interactive" &&
	presentation.interactive &&
	!explicitNonInteractive &&
	isInteractiveTerminal();

export const getPromptGuardError = ({
	command,
	presentation,
	interactivePolicy,
	explicitNonInteractive = false,
}: PromptPolicyOptions): string | null => {
	if (interactivePolicy === "default-non-interactive") {
		return null;
	}
	if (explicitNonInteractive || shouldPrompt({ command, presentation, interactivePolicy })) {
		return null;
	}
	return nonInteractiveMessage(command);
};
