import { GuidedConfirm, type PresentationProfile, type WorkflowRunState } from "@mimirmesh/ui";
import { Box } from "ink";
import { useState } from "react";
import type zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { createGuardedWorkflow } from "../../lib/guarded-workflow";
import { getPromptGuardError, shouldPrompt } from "../../lib/non-interactive";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";
import { createRuntimeActionWorkflow } from "../../workflows/runtime";

export const options = withPresentationOptions({}, { allowNonInteractive: true });

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function RuntimeStartCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const resolvedPresentation = presentation ?? resolvePresentationProfile(options);
	const baseDefinition = createRuntimeActionWorkflow("start");
	const [confirmed, setConfirmed] = useState(false);
	const [cancelled, setCancelled] = useState(false);
	const promptError = getPromptGuardError({
		command: "`mimirmesh runtime start`",
		presentation: resolvedPresentation,
		interactivePolicy: "default-interactive",
		explicitNonInteractive: options.nonInteractive,
	});

	if (cancelled) {
		return (
			<CommandRunner
				definition={createGuardedWorkflow(
					baseDefinition,
					"Runtime start cancelled.",
					"The runtime start action was cancelled before services were started.",
					[],
					"Re-run the command and confirm the action when you are ready to start the runtime.",
				)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	return !confirmed &&
		!promptError &&
		shouldPrompt({
			command: "`mimirmesh runtime start`",
			presentation: resolvedPresentation,
			interactivePolicy: "default-interactive",
			explicitNonInteractive: options.nonInteractive,
		}) ? (
		<Box>
			<GuidedConfirm
				title="Confirm runtime start"
				reason="Starting the runtime launches project-local Docker services and runtime routing."
				consequence="Project-local runtime services will start and live health checks will run."
				nonInteractiveFallback="mimirmesh runtime start --non-interactive"
				onConfirm={() => {
					setConfirmed(true);
				}}
				onCancel={() => {
					setCancelled(true);
				}}
			/>
		</Box>
	) : (
		<CommandRunner
			definition={
				promptError
					? createGuardedWorkflow(
							baseDefinition,
							promptError,
							"Runtime start did not begin because this mutating workflow needs an explicit automation-safe invocation.",
							["Runtime start"],
							"Re-run `mimirmesh runtime start --non-interactive` or use an interactive terminal.",
						)
					: baseDefinition
			}
			presentation={resolvedPresentation}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
