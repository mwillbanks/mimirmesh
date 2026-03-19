import { GuidedConfirm, type PresentationProfile, type WorkflowRunState } from "@mimirmesh/ui";
import { Box } from "ink";
import { argument } from "pastel";
import { useState } from "react";
import zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { configDisableEngine } from "../../lib/context";
import { createContextWorkflow } from "../../lib/context-workflow";
import { createGuardedWorkflow } from "../../lib/guarded-workflow";
import { getPromptGuardError, shouldPrompt } from "../../lib/non-interactive";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";

const engineSchema = zod.enum(["srclight", "document-mcp", "mcp-adr-analysis-server"]);

export const args = zod.tuple([
	engineSchema.describe(argument({ name: "engine", description: "Engine id to disable" })),
]);

export const options = withPresentationOptions({}, { allowNonInteractive: true });

type Props = {
	args: zod.infer<typeof args>;
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function ConfigDisableCommand({
	args,
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const [engine] = args;
	const resolvedPresentation = presentation ?? resolvePresentationProfile(options);
	const [confirmed, setConfirmed] = useState<boolean>(false);
	const [cancelled, setCancelled] = useState<boolean>(false);
	const baseDefinition = createContextWorkflow({
		id: "config-disable",
		title: "Disable Engine",
		description:
			"Disable an engine in the project-local config so runtime and routing stop depending on it.",
		category: "configuration",
		interactivePolicy: "default-interactive",
		recommendedNextActions: ["runtime-status", "config-validate"],
		stepLabel: "Disable engine",
		stepKind: "generation",
		run: async (context) => {
			await configDisableEngine(context, engine);
			return {
				kind: "success",
				message: `Disabled engine ${engine}.`,
				impact: "The selected engine is now disabled in the project-local configuration.",
				nextAction:
					"Run `mimirmesh runtime status` to verify the disabled engine no longer appears in runtime health.",
				evidence: [{ label: "Engine", value: engine }],
				machineReadablePayload: { engine },
			};
		},
	});
	const promptError = getPromptGuardError({
		command: "`mimirmesh config disable <engine>`",
		presentation: resolvedPresentation,
		interactivePolicy: "default-interactive",
		explicitNonInteractive: options.nonInteractive,
	});

	if (cancelled) {
		return (
			<CommandRunner
				definition={createGuardedWorkflow(
					baseDefinition,
					"Engine disablement cancelled.",
					"The selected engine remains enabled in config.",
					[],
					"Re-run the command and confirm the engine disablement if you still want to apply it.",
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
					"Engine disablement did not begin because this workflow needs an explicit automation-safe invocation.",
					["Engine disablement"],
					"Re-run `mimirmesh config disable <engine> --non-interactive` or use an interactive terminal.",
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
			command: "`mimirmesh config disable`",
			presentation: resolvedPresentation,
			interactivePolicy: "default-interactive",
			explicitNonInteractive: options.nonInteractive,
		})
	) {
		return (
			<Box>
				<GuidedConfirm
					title="Confirm engine disablement"
					reason="Disabling an engine changes runtime startup, routing, and passthrough availability."
					consequence={`The ${engine} engine will be marked disabled in .mimirmesh/config.yml.`}
					nonInteractiveFallback="mimirmesh config disable <engine> --non-interactive"
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
