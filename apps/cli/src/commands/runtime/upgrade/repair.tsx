import { GuidedConfirm, type PresentationProfile, type WorkflowRunState } from "@mimirmesh/ui";
import { Box } from "ink";
import { useState } from "react";
import type zod from "zod/v4";

import { CommandRunner } from "../../../lib/command-runner";
import { createGuardedWorkflow } from "../../../lib/guarded-workflow";
import { getPromptGuardError, shouldPrompt } from "../../../lib/non-interactive";
import { resolvePresentationProfile, withPresentationOptions } from "../../../lib/presentation";
import { createRuntimeUpgradeRepairWorkflow } from "../../../workflows/runtime";

export const options = withPresentationOptions({}, { allowNonInteractive: true });

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function RuntimeUpgradeRepairCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const resolvedPresentation = presentation ?? resolvePresentationProfile(options);
	const baseDefinition = createRuntimeUpgradeRepairWorkflow();
	const [confirmed, setConfirmed] = useState(false);
	const [cancelled, setCancelled] = useState(false);
	const promptError = getPromptGuardError({
		command: "`mimirmesh runtime upgrade repair`",
		presentation: resolvedPresentation,
		interactivePolicy: "default-interactive",
		explicitNonInteractive: options.nonInteractive,
	});

	if (cancelled) {
		return (
			<CommandRunner
				definition={createGuardedWorkflow(
					baseDefinition,
					"Runtime repair cancelled.",
					"The runtime repair action was cancelled before preserved assets were repaired.",
					[],
					"Re-run the command and confirm the action when you are ready to repair runtime state.",
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
			command: "`mimirmesh runtime upgrade repair`",
			presentation: resolvedPresentation,
			interactivePolicy: "default-interactive",
			explicitNonInteractive: options.nonInteractive,
		}) ? (
		<Box>
			<GuidedConfirm
				title="Confirm runtime repair"
				reason="Repairing runtime state can restore quarantined assets and rewrite upgrade metadata."
				consequence="The CLI will attempt the documented repair path and then verify preserved asset health."
				nonInteractiveFallback="mimirmesh runtime upgrade repair --non-interactive"
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
							"Runtime repair did not begin because this mutating workflow needs an explicit automation-safe invocation.",
							["Automatic runtime repair"],
							"Re-run `mimirmesh runtime upgrade repair --non-interactive` or use an interactive terminal.",
						)
					: baseDefinition
			}
			presentation={resolvedPresentation}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
