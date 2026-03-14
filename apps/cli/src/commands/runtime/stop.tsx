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

export default function RuntimeStopCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const resolvedPresentation = presentation ?? resolvePresentationProfile(options);
	const baseDefinition = createRuntimeActionWorkflow("stop");
	const [confirmed, setConfirmed] = useState(false);
	const [cancelled, setCancelled] = useState(false);
	const promptError = getPromptGuardError({
		command: "`mimirmesh runtime stop`",
		presentation: resolvedPresentation,
		interactivePolicy: "default-interactive",
		explicitNonInteractive: options.nonInteractive,
	});

	if (cancelled) {
		return (
			<CommandRunner
				definition={createGuardedWorkflow(
					baseDefinition,
					"Runtime stop cancelled.",
					"The runtime stop action was cancelled before services were stopped.",
					[],
					"Re-run the command and confirm the action when you are ready to stop the runtime.",
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
			command: "`mimirmesh runtime stop`",
			presentation: resolvedPresentation,
			interactivePolicy: "default-interactive",
			explicitNonInteractive: options.nonInteractive,
		}) ? (
		<Box>
			<GuidedConfirm
				title="Confirm runtime stop"
				reason="Stopping the runtime takes project-local services and passthrough MCP routes offline."
				consequence="Runtime-backed workflows will be unavailable until the runtime is started again."
				nonInteractiveFallback="mimirmesh runtime stop --non-interactive"
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
							"Runtime stop did not begin because this mutating workflow needs an explicit automation-safe invocation.",
							["Runtime stop"],
							"Re-run `mimirmesh runtime stop --non-interactive` or use an interactive terminal.",
						)
					: baseDefinition
			}
			presentation={resolvedPresentation}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
