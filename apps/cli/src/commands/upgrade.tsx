import { GuidedConfirm, type PresentationProfile, type WorkflowRunState } from "@mimirmesh/ui";
import { Box } from "ink";
import { useState } from "react";
import type zod from "zod/v4";

import { CommandRunner } from "../lib/command-runner";
import { createGuardedWorkflow } from "../lib/guarded-workflow";
import { getPromptGuardError, shouldPrompt } from "../lib/non-interactive";
import { resolvePresentationProfile, withPresentationOptions } from "../lib/presentation";
import { createRuntimeUpgradeMigrateWorkflow } from "../workflows/runtime";

export const options = withPresentationOptions({}, { allowNonInteractive: true });

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

const blockedUpgradeDefinition = (message: string) => ({
	...createRuntimeUpgradeMigrateWorkflow(),
	execute: async () => ({
		kind: "failed" as const,
		message,
		impact:
			"Runtime upgrade did not begin because the command needs an explicit automation-safe invocation.",
		completedWork: [],
		blockedCapabilities: ["Automatic runtime upgrade"],
		nextAction: "Re-run `mimirmesh upgrade --non-interactive` or use an interactive terminal.",
	}),
});

export default function UpgradeCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const resolvedPresentation = presentation ?? resolvePresentationProfile(options);
	const [confirmed, setConfirmed] = useState(false);
	const [cancelled, setCancelled] = useState(false);
	const promptError = getPromptGuardError({
		command: "`mimirmesh upgrade`",
		presentation: resolvedPresentation,
		interactivePolicy: "default-interactive",
		explicitNonInteractive: options.nonInteractive,
	});

	if (cancelled) {
		return (
			<CommandRunner
				definition={createGuardedWorkflow(
					createRuntimeUpgradeMigrateWorkflow(),
					"Runtime upgrade cancelled.",
					"The runtime upgrade action was cancelled before migration began.",
					[],
					"Re-run the command and confirm the action when you are ready to upgrade runtime state.",
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
			command: "`mimirmesh upgrade`",
			presentation: resolvedPresentation,
			interactivePolicy: "default-interactive",
			explicitNonInteractive: options.nonInteractive,
		}) ? (
		<Box>
			<GuidedConfirm
				title="Confirm runtime upgrade"
				reason="Upgrading runtime state can migrate preserved runtime data and reconcile generated runtime assets."
				consequence="The CLI will run the supported in-place runtime migration workflow."
				nonInteractiveFallback="mimirmesh upgrade --non-interactive"
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
				promptError ? blockedUpgradeDefinition(promptError) : createRuntimeUpgradeMigrateWorkflow()
			}
			presentation={resolvedPresentation}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
