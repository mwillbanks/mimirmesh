import { GuidedConfirm, type PresentationProfile, type WorkflowRunState } from "@mimirmesh/ui";
import { Box } from "ink";
import { argument } from "pastel";
import { useState } from "react";
import zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { configEnableEngine } from "../../lib/context";
import { createContextWorkflow } from "../../lib/context-workflow";
import { createGuardedWorkflow } from "../../lib/guarded-workflow";
import { getPromptGuardError, shouldPrompt } from "../../lib/non-interactive";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";

const engineSchema = zod.enum([
	"codebase-memory-mcp",
	"srclight",
	"document-mcp",
	"mcp-adr-analysis-server",
]);

export const args = zod.tuple([
	engineSchema.describe(argument({ name: "engine", description: "Engine id to enable" })),
]);

export const options = withPresentationOptions({}, { allowNonInteractive: true });

type Props = {
	args: zod.infer<typeof args>;
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function ConfigEnableCommand({
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
		id: "config-enable",
		title: "Enable Engine",
		description:
			"Enable an engine in the project-local config so runtime and routing can include it.",
		category: "configuration",
		interactivePolicy: "default-interactive",
		recommendedNextActions: ["runtime-status", "config-validate"],
		stepLabel: "Enable engine",
		stepKind: "generation",
		run: async (context) => {
			await configEnableEngine(context, engine);
			return {
				kind: "success",
				message: `Enabled engine ${engine}.`,
				impact: "The selected engine is now enabled in the project-local configuration.",
				nextAction:
					"Run `mimirmesh runtime status` or `mimirmesh runtime start` to verify the enabled engine becomes available.",
				evidence: [{ label: "Engine", value: engine }],
				machineReadablePayload: { engine },
			};
		},
	});
	const promptError = getPromptGuardError({
		command: "`mimirmesh config enable <engine>`",
		presentation: resolvedPresentation,
		interactivePolicy: "default-interactive",
		explicitNonInteractive: options.nonInteractive,
	});

	if (cancelled) {
		return (
			<CommandRunner
				definition={createGuardedWorkflow(
					baseDefinition,
					"Engine enablement cancelled.",
					"The selected engine remains disabled in config.",
					[],
					"Re-run the command and confirm the engine enablement if you still want to apply it.",
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
					"Engine enablement did not begin because this workflow needs an explicit automation-safe invocation.",
					["Engine enablement"],
					"Re-run `mimirmesh config enable <engine> --non-interactive` or use an interactive terminal.",
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
			command: "`mimirmesh config enable`",
			presentation: resolvedPresentation,
			interactivePolicy: "default-interactive",
			explicitNonInteractive: options.nonInteractive,
		})
	) {
		return (
			<Box>
				<GuidedConfirm
					title="Confirm engine enablement"
					reason="Enabling an engine changes runtime startup, routing, and MCP exposure."
					consequence={`The ${engine} engine will be marked enabled in .mimirmesh/config.yml.`}
					nonInteractiveFallback="mimirmesh config enable <engine> --non-interactive"
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
