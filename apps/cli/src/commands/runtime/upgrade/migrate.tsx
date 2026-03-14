import { GuidedConfirm, type PresentationProfile, type WorkflowRunState } from "@mimirmesh/ui";
import { Box } from "ink";
import { useState } from "react";
import type zod from "zod/v4";

import { CommandRunner } from "../../../lib/command-runner";
import { createGuardedWorkflow } from "../../../lib/guarded-workflow";
import { getPromptGuardError, shouldPrompt } from "../../../lib/non-interactive";
import { resolvePresentationProfile, withPresentationOptions } from "../../../lib/presentation";
import { createRuntimeUpgradeMigrateWorkflow } from "../../../workflows/runtime";

export const options = withPresentationOptions({}, { allowNonInteractive: true });

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function RuntimeUpgradeMigrateCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const resolvedPresentation = presentation ?? resolvePresentationProfile(options);
	const baseDefinition = createRuntimeUpgradeMigrateWorkflow();
	const [confirmed, setConfirmed] = useState(false);
	const [cancelled, setCancelled] = useState(false);
	const promptError = getPromptGuardError({
		command: "`mimirmesh runtime upgrade migrate`",
		presentation: resolvedPresentation,
		interactivePolicy: "default-interactive",
		explicitNonInteractive: options.nonInteractive,
	});

	if (cancelled) {
		return (
			<CommandRunner
				definition={createGuardedWorkflow(
					baseDefinition,
					"Runtime migration cancelled.",
					"The runtime migration action was cancelled before upgrade state changed.",
					[],
					"Re-run the command and confirm the action when you are ready to migrate runtime state.",
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
			command: "`mimirmesh runtime upgrade migrate`",
			presentation: resolvedPresentation,
			interactivePolicy: "default-interactive",
			explicitNonInteractive: options.nonInteractive,
		}) ? (
		<Box>
			<GuidedConfirm
				title="Confirm runtime migration"
				reason="Migrating runtime state can rewrite preserved runtime metadata and reconcile generated runtime assets."
				consequence="The CLI will run the supported in-place migration path and then verify the resulting upgrade state."
				nonInteractiveFallback="mimirmesh runtime upgrade migrate --non-interactive"
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
							"Runtime migration did not begin because this mutating workflow needs an explicit automation-safe invocation.",
							["Automatic runtime migration"],
							"Re-run `mimirmesh runtime upgrade migrate --non-interactive` or use an interactive terminal.",
						)
					: baseDefinition
			}
			presentation={resolvedPresentation}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
