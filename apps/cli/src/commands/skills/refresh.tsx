import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import { option } from "pastel";
import type zod from "zod/v4";
import z from "zod/v4";

import { type CommandHelpDefinition, CommandHelpView } from "../../lib/command-help";
import { CommandRunner } from "../../lib/command-runner";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";
import { createSkillsRefreshWorkflow } from "../../workflows/skills";
import { splitCommaList } from "./shared";

export const options = withPresentationOptions(
	{
		names: z
			.string()
			.optional()
			.describe(option({ description: "Comma-separated skill names" })),
		scope: z
			.enum(["repo", "all"])
			.optional()
			.describe(option({ description: "Refresh scope" })),
		invalidateNotFound: z
			.boolean()
			.optional()
			.describe(option({ description: "Invalidate negative cache entries" })),
		reindexEmbeddings: z
			.boolean()
			.optional()
			.describe(option({ description: "Reindex embeddings" })),
	},
	{ allowNonInteractive: true },
);

export const help: CommandHelpDefinition = {
	title: "mimirmesh skills refresh",
	usage: "mimirmesh skills refresh [flags]",
	flags: [
		{ flag: "--names <name[,name]>", description: "Refresh only specific skills." },
		{ flag: "--scope <repo|all>", description: "Refresh repository scope or all known state." },
		{ flag: "--invalidate-not-found", description: "Invalidate negative cache assumptions." },
		{ flag: "--reindex-embeddings", description: "Request embedding reindexing when available." },
		{ flag: "--json", description: "Emit machine-readable output." },
	],
	sections: [
		{
			title: "Behavior",
			lines: [
				"Refresh invalidates stale positive and negative cache assumptions for the repository.",
				"Embedding reindexing is optional and non-blocking.",
			],
		},
	],
	examples: [
		"mimirmesh skills refresh",
		"mimirmesh skills refresh --scope repo --invalidate-not-found --reindex-embeddings",
	],
};

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function SkillsRefreshCommand({
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
			definition={createSkillsRefreshWorkflow({
				names: splitCommaList(options.names),
				scope: options.scope,
				invalidateNotFound: options.invalidateNotFound,
				reindexEmbeddings: options.reindexEmbeddings,
			})}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
