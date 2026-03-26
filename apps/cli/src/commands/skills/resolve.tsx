import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import { argument, option } from "pastel";
import type zod from "zod/v4";
import z from "zod/v4";

import { type CommandHelpDefinition, CommandHelpView } from "../../lib/command-help";
import { CommandRunner } from "../../lib/command-runner";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";
import { createSkillsResolveWorkflow } from "../../workflows/skills";
import { parseJsonObject, splitCommaList } from "./shared";

export const args = z.tuple([
	z
		.string()
		.min(1)
		.describe(argument({ name: "prompt", description: "Prompt text to resolve" })),
]);

export const options = withPresentationOptions(
	{
		taskMetadata: z
			.string()
			.optional()
			.describe(option({ description: "JSON object with task metadata" })),
		mcpEngineContext: z
			.string()
			.optional()
			.describe(option({ description: "JSON object with optional MCP engine context" })),
		include: z
			.string()
			.optional()
			.describe(option({ description: "Comma-separated optional fields" })),
		limit: z.coerce
			.number()
			.int()
			.positive()
			.optional()
			.describe(option({ description: "Maximum number of results" })),
	},
	{ allowNonInteractive: true },
);

export const help: CommandHelpDefinition = {
	title: "mimirmesh skills resolve",
	usage: "mimirmesh skills resolve <prompt> [flags]",
	flags: [
		{ flag: "--task-metadata <json>", description: "JSON object with task metadata." },
		{
			flag: "--mcp-engine-context <json>",
			description: "JSON object with optional MCP engine context.",
		},
		{ flag: "--include <field[,field]>", description: "Opt in to additional result fields." },
		{ flag: "--limit <n>", description: "Maximum number of results." },
		{ flag: "--json", description: "Emit machine-readable output." },
	],
	sections: [
		{
			title: "Behavior",
			lines: [
				"Resolution is deterministic for identical prompt and repository state.",
				"`AGENTS.md` is never used as a ranking source.",
			],
		},
	],
	examples: [
		'mimirmesh skills resolve "improve the skill install workflow"',
		'mimirmesh skills resolve "update the authoring flow" --include matchReason,readHint',
	],
};

type Props = {
	args: zod.infer<typeof args>;
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function SkillsResolveCommand({
	args,
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const [prompt] = args;
	if (options.help) {
		return <CommandHelpView definition={help} />;
	}

	return (
		<CommandRunner
			definition={createSkillsResolveWorkflow({
				prompt,
				taskMetadata: parseJsonObject(options.taskMetadata),
				mcpEngineContext: parseJsonObject(options.mcpEngineContext),
				include: splitCommaList(options.include),
				limit: options.limit,
			})}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
