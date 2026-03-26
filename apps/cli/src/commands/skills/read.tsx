import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import { argument, option } from "pastel";
import type zod from "zod/v4";
import z from "zod/v4";

import { type CommandHelpDefinition, CommandHelpView } from "../../lib/command-help";
import { CommandRunner } from "../../lib/command-runner";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";
import { createSkillsReadWorkflow } from "../../workflows/skills";
import { parseStringArrayMap, splitCommaList } from "./shared";

export const args = z.tuple([
	z
		.string()
		.min(1)
		.describe(argument({ name: "skill-name", description: "Skill to read" })),
]);

export const options = withPresentationOptions(
	{
		mode: z
			.enum(["memory", "instructions", "assets", "full"])
			.optional()
			.describe(option({ description: "Read mode" })),
		include: z
			.string()
			.optional()
			.describe(option({ description: "Comma-separated optional parts" })),
		select: z
			.string()
			.optional()
			.describe(option({ description: "JSON object of named selections" })),
	},
	{ allowNonInteractive: true },
);

export const help: CommandHelpDefinition = {
	title: "mimirmesh skills read",
	usage: "mimirmesh skills read <skill-name> [flags]",
	flags: [
		{ flag: "--mode <memory|instructions|assets|full>", description: "Read mode." },
		{ flag: "--include <field[,field]>", description: "Opt in to optional sections or indexes." },
		{
			flag: "--select <json>",
			description: "JSON object selecting specific named sections or assets.",
		},
		{ flag: "--json", description: "Emit machine-readable output." },
	],
	sections: [
		{
			title: "Behavior",
			lines: [
				"Default mode is `memory` when no explicit mode is supplied.",
				"Only the requested sections and assets are returned.",
			],
		},
	],
	examples: [
		"mimirmesh skills read mimirmesh-code-navigation",
		"mimirmesh skills read mimirmesh-code-navigation --mode instructions --include instructions,referencesIndex",
	],
};

type Props = {
	args: zod.infer<typeof args>;
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function SkillsReadCommand({
	args,
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const [name] = args;
	if (options.help) {
		return <CommandHelpView definition={help} />;
	}

	return (
		<CommandRunner
			definition={createSkillsReadWorkflow({
				name,
				mode: options.mode,
				include: splitCommaList(options.include),
				select: parseStringArrayMap(options.select),
			})}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
