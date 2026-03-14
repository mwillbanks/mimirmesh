import type { InstallTarget } from "@mimirmesh/installer";
import { GuidedSelect, type PresentationProfile, type WorkflowRunState } from "@mimirmesh/ui";
import { Box, Text } from "ink";
import { useState } from "react";
import zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { createGuardedWorkflow } from "../../lib/guarded-workflow";
import { getPromptGuardError } from "../../lib/non-interactive";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";
import { createInstallIdeWorkflow } from "../../workflows/init";

const ideChoices = [
	{
		label: "VS Code",
		value: "vscode",
		description: "Write `.vscode/mcp.json`.",
		recommended: true,
	},
	{ label: "Cursor", value: "cursor", description: "Write `.cursor/mcp.json`." },
	{ label: "Claude", value: "claude", description: "Write `.claude/mcp.json`." },
	{ label: "Codex", value: "codex", description: "Write `.codex/mcp.json`." },
] as const;

export const options = withPresentationOptions(
	{
		target: zod.enum(["vscode", "cursor", "claude", "codex"]).optional(),
		serverCommand: zod.string().optional().describe("Override the MCP server command"),
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

export default function InstallIdeCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const resolvedPresentation = presentation ?? resolvePresentationProfile(options);
	const [selectedTarget, setSelectedTarget] = useState<string | null>(options.target ?? null);
	const baseDefinition = createInstallIdeWorkflow({
		target: (selectedTarget ?? options.target ?? "vscode") as InstallTarget,
		serverCommand: options.serverCommand,
	});
	const promptError = getPromptGuardError({
		command: "`mimirmesh install ide`",
		presentation: resolvedPresentation,
		interactivePolicy: "default-interactive",
		explicitNonInteractive: options.nonInteractive,
	});

	if (promptError) {
		return (
			<CommandRunner
				definition={createGuardedWorkflow(
					baseDefinition,
					promptError,
					"IDE integration did not begin because this mutating workflow needs an explicit automation-safe invocation.",
					["IDE MCP configuration"],
					"Re-run `mimirmesh install ide --non-interactive --target vscode|cursor|claude|codex` or use an interactive terminal.",
				)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	if (!options.target && selectedTarget === null) {
		if (!resolvedPresentation.interactive) {
			return (
				<CommandRunner
					definition={createGuardedWorkflow(
						baseDefinition,
						"An explicit IDE target is required in non-interactive mode.",
						"The CLI cannot open an IDE target selector in a non-interactive terminal.",
						["IDE MCP configuration"],
						"Re-run `mimirmesh install ide --non-interactive --target vscode|cursor|claude|codex` or use an interactive terminal.",
					)}
					presentation={resolvedPresentation}
					exitOnComplete={exitOnComplete}
					onComplete={onComplete}
				/>
			);
		}

		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Install IDE MCP Integration</Text>
				<GuidedSelect
					title="Choose an IDE or agent"
					reason="The CLI needs a target so it can write the correct project-local MCP configuration file."
					consequence="The selected target receives a new or updated `mcp.json` entry for the `mimirmesh` server."
					nonInteractiveFallback="mimirmesh install ide --non-interactive --target vscode|cursor|claude|codex"
					choices={ideChoices}
					defaultValue="vscode"
					onSubmit={(value) => {
						setSelectedTarget(value);
					}}
				/>
			</Box>
		);
	}

	return (
		<CommandRunner
			definition={createInstallIdeWorkflow({
				target: (selectedTarget ?? options.target ?? "vscode") as InstallTarget,
				serverCommand: options.serverCommand,
			})}
			presentation={resolvedPresentation}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
