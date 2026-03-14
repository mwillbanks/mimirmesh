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

export default function RuntimeRefreshCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const resolvedPresentation = presentation ?? resolvePresentationProfile(options);
	const baseDefinition = createRuntimeActionWorkflow("refresh");
	const [confirmed, setConfirmed] = useState(false);
	const [cancelled, setCancelled] = useState(false);
	const promptError = getPromptGuardError({
		command: "`mimirmesh runtime refresh`",
		presentation: resolvedPresentation,
		interactivePolicy: "default-interactive",
		explicitNonInteractive: options.nonInteractive,
	});

	if (cancelled) {
		return (
			<CommandRunner
				definition={createGuardedWorkflow(
					baseDefinition,
					"Runtime refresh cancelled.",
					"The runtime refresh action was cancelled before health and routing state were refreshed.",
					[],
					"Re-run the command and confirm the action when you are ready to refresh the runtime.",
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
			command: "`mimirmesh runtime refresh`",
			presentation: resolvedPresentation,
			interactivePolicy: "default-interactive",
			explicitNonInteractive: options.nonInteractive,
		}) ? (
		<Box>
			<GuidedConfirm
				title="Confirm runtime refresh"
				reason="Refreshing the runtime updates live health, routing, and related readiness evidence."
				consequence="Runtime status and generated runtime evidence will be refreshed from live checks."
				nonInteractiveFallback="mimirmesh runtime refresh --non-interactive"
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
							"Runtime refresh did not begin because this mutating workflow needs an explicit automation-safe invocation.",
							["Runtime refresh"],
							"Re-run `mimirmesh runtime refresh --non-interactive` or use an interactive terminal.",
						)
					: baseDefinition
			}
			presentation={resolvedPresentation}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
