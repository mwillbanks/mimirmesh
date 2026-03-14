import { GuidedSelect, type PresentationProfile, type WorkflowRunState } from "@mimirmesh/ui";
import { Box, Text } from "ink";
import { useState } from "react";
import zod from "zod/v4";

import { CommandRunner } from "../lib/command-runner";
import { getPromptGuardError, shouldPrompt } from "../lib/non-interactive";
import { resolvePresentationProfile, withPresentationOptions } from "../lib/presentation";
import { createInitWorkflow } from "../workflows/init";

const ideChoices = [
	{
		label: "Skip IDE setup for now",
		value: "skip",
		description: "Initialize the project now and add IDE integration later if needed.",
		recommended: true,
	},
	{
		label: "VS Code",
		value: "vscode",
		description: "Write `.vscode/mcp.json` for the local project.",
	},
	{
		label: "Cursor",
		value: "cursor",
		description: "Write `.cursor/mcp.json` for the local project.",
	},
	{
		label: "Claude",
		value: "claude",
		description: "Write `.claude/mcp.json` for the local project.",
	},
	{
		label: "Codex",
		value: "codex",
		description: "Write `.codex/mcp.json` for the local project.",
	},
] as const;

export const options = withPresentationOptions(
	{
		ide: zod.enum(["vscode", "cursor", "claude", "codex"]).optional(),
	},
	{ allowNonInteractive: true },
);

type OptionValues = zod.infer<typeof options>;

type Props = {
	options: OptionValues;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

const blockedInitDefinition = (message: string) => ({
	...createInitWorkflow(),
	execute: async () => ({
		kind: "failed" as const,
		message,
		impact:
			"Initialization did not begin because the command needs an explicit automation-safe invocation.",
		completedWork: [],
		blockedCapabilities: ["Project initialization"],
		nextAction: "Re-run `mimirmesh init --non-interactive` or use an interactive terminal.",
	}),
});

export default function InitCommand({ options, presentation, exitOnComplete, onComplete }: Props) {
	const resolvedPresentation = presentation ?? resolvePresentationProfile(options);
	const promptError = getPromptGuardError({
		command: "`mimirmesh init`",
		presentation: resolvedPresentation,
		interactivePolicy: "default-interactive",
		explicitNonInteractive: options.nonInteractive,
	});
	const [promptChoice, setPromptChoice] = useState<string | null>(options.ide ?? null);

	if (promptError) {
		return (
			<CommandRunner
				definition={blockedInitDefinition(promptError)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	if (
		!options.ide &&
		promptChoice === null &&
		shouldPrompt({
			command: "`mimirmesh init`",
			presentation: resolvedPresentation,
			interactivePolicy: "default-interactive",
			explicitNonInteractive: options.nonInteractive,
		})
	) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Initialize MímirMesh</Text>
				<GuidedSelect
					title="Optional IDE integration"
					reason="Initialization can also write IDE MCP configuration while the project context is fresh."
					consequence="Choosing an IDE writes a project-local MCP config file for that target."
					nonInteractiveFallback="mimirmesh init --non-interactive [--ide vscode|cursor|claude|codex]"
					choices={ideChoices}
					defaultValue="skip"
					onSubmit={(value) => {
						setPromptChoice(value);
					}}
				/>
			</Box>
		);
	}

	return (
		<CommandRunner
			definition={createInitWorkflow({
				ideTarget: ((promptChoice === "skip" ? undefined : promptChoice) ??
					options.ide) as OptionValues["ide"],
			})}
			presentation={resolvedPresentation}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
