import { GuidedConfirm, type PresentationProfile, type WorkflowRunState } from "@mimirmesh/ui";
import { Box } from "ink";
import { argument } from "pastel";
import { useState } from "react";
import zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { configSet } from "../../lib/context";
import { createContextWorkflow } from "../../lib/context-workflow";
import { createGuardedWorkflow } from "../../lib/guarded-workflow";
import { getPromptGuardError, shouldPrompt } from "../../lib/non-interactive";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";

export const args = zod.tuple([
	zod
		.string()
		.describe(
			argument({ name: "path", description: "Dot path in config (example: logging.level)" }),
		),
	zod
		.string()
		.describe(argument({ name: "value", description: "New value for the provided path" })),
]);

export const options = withPresentationOptions({}, { allowNonInteractive: true });

type Props = {
	args: zod.infer<typeof args>;
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function ConfigSetCommand({
	args,
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const [path, value] = args;
	const resolvedPresentation = presentation ?? resolvePresentationProfile(options);
	const [confirmed, setConfirmed] = useState<boolean>(false);
	const [cancelled, setCancelled] = useState<boolean>(false);
	const baseDefinition = createContextWorkflow({
		id: "config-set",
		title: "Update Configuration",
		description: "Write a new value to the project-local MímirMesh config file.",
		category: "configuration",
		interactivePolicy: "default-interactive",
		recommendedNextActions: ["config-validate", "config-get"],
		stepLabel: "Write configuration value",
		stepKind: "generation",
		run: async (context) => {
			await configSet(context, path, value);
			return {
				kind: "success",
				message: `Updated config path ${path}.`,
				impact: "The project-local configuration now reflects the requested value.",
				nextAction: "Run `mimirmesh config validate` if you changed a structural config value.",
				evidence: [
					{ label: "Path", value: path },
					{ label: "Value", value },
				],
				machineReadablePayload: { path, value },
			};
		},
	});
	const promptError = getPromptGuardError({
		command: "`mimirmesh config set <path> <value>`",
		presentation: resolvedPresentation,
		interactivePolicy: "default-interactive",
		explicitNonInteractive: options.nonInteractive,
	});

	if (cancelled) {
		return (
			<CommandRunner
				definition={createGuardedWorkflow(
					baseDefinition,
					"Configuration update cancelled.",
					"No config values were changed.",
					[],
					"Re-run the command and confirm the change if you still want to apply it.",
				)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	if (promptError) {
		return (
			<CommandRunner
				definition={createGuardedWorkflow(
					baseDefinition,
					promptError,
					"Configuration mutation did not begin because this workflow needs an explicit automation-safe invocation.",
					["Config mutation"],
					"Re-run `mimirmesh config set <path> <value> --non-interactive` or use an interactive terminal.",
				)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	if (
		!confirmed &&
		shouldPrompt({
			command: "`mimirmesh config set`",
			presentation: resolvedPresentation,
			interactivePolicy: "default-interactive",
			explicitNonInteractive: options.nonInteractive,
		})
	) {
		return (
			<Box>
				<GuidedConfirm
					title="Confirm configuration update"
					reason="Changing config values can alter runtime behavior, routing, or enabled integrations."
					consequence={`This will set ${path} to ${value} in .mimirmesh/config.yml.`}
					nonInteractiveFallback="mimirmesh config set <path> <value> --non-interactive"
					onConfirm={() => {
						setConfirmed(true);
					}}
					onCancel={() => {
						setCancelled(true);
					}}
				/>
			</Box>
		);
	}

	return (
		<CommandRunner
			definition={baseDefinition}
			presentation={resolvedPresentation}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
