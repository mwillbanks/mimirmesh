import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import { option } from "pastel";
import type zod from "zod/v4";
import z from "zod/v4";

import { type CommandHelpDefinition, CommandHelpView } from "../../lib/command-help";
import { CommandRunner } from "../../lib/command-runner";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";
import { createSkillsFindWorkflow } from "../../workflows/skills";
import { splitCommaList } from "./shared";

export const options = withPresentationOptions(
	{
		query: z
			.string()
			.optional()
			.describe(option({ description: "Search text for skills" })),
		names: z
			.string()
			.optional()
			.describe(option({ description: "Comma-separated skill names" })),
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
		offset: z.coerce
			.number()
			.int()
			.min(0)
			.optional()
			.describe(option({ description: "Result offset" })),
	},
	{ allowNonInteractive: true },
);

export const help: CommandHelpDefinition = {
	title: "mimirmesh skills find",
	usage: "mimirmesh skills find [flags]",
	flags: [
		{ flag: "--query <text>", description: "Search text for skills." },
		{ flag: "--names <name[,name]>", description: "Limit to specific skill names." },
		{ flag: "--include <field[,field]>", description: "Opt in to optional descriptor fields." },
		{ flag: "--limit <n>", description: "Maximum number of results." },
		{ flag: "--offset <n>", description: "Result offset." },
		{ flag: "--json", description: "Emit machine-readable output." },
	],
	sections: [
		{
			title: "Behavior",
			lines: [
				"Without search criteria, `find` returns the minimal discovery list view.",
				"With search criteria, `find` returns the deterministic ranked discovery view.",
			],
		},
	],
	examples: [
		"mimirmesh skills find",
		'mimirmesh skills find --query "code navigation" --include description,summary',
	],
};

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function SkillsFindCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	if (options.help) {
		return <CommandHelpView definition={help} />;
	}

	return (
		<CommandRunner
			definition={createSkillsFindWorkflow({
				query: options.query,
				names: splitCommaList(options.names),
				include: splitCommaList(options.include),
				limit: options.limit,
				offset: options.offset,
			})}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
