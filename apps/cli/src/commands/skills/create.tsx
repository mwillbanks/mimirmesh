import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import { option } from "pastel";
import type zod from "zod/v4";
import z from "zod/v4";

import { type CommandHelpDefinition, CommandHelpView } from "../../lib/command-help";
import { CommandRunner } from "../../lib/command-runner";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";
import { createSkillsCreateWorkflow } from "../../workflows/skills";

export const options = withPresentationOptions(
	{
		prompt: z
			.string()
			.optional()
			.describe(option({ description: "Authoring prompt" })),
		targetPath: z
			.string()
			.optional()
			.describe(option({ description: "Optional target path" })),
		template: z
			.string()
			.optional()
			.describe(option({ description: "Optional template name or path" })),
		mode: z
			.enum(["analyze", "generate", "write"])
			.optional()
			.describe(option({ description: "Authoring mode" })),
		includeRecommendations: z.boolean().optional(),
		includeGapAnalysis: z.boolean().optional(),
		includeCompletenessAnalysis: z.boolean().optional(),
		includeConsistencyAnalysis: z.boolean().optional(),
		validateBeforeWrite: z.boolean().optional(),
	},
	{ allowNonInteractive: true },
);

export const help: CommandHelpDefinition = {
	title: "mimirmesh skills create",
	usage: "mimirmesh skills create [flags]",
	flags: [
		{ flag: "--prompt <text>", description: "Authoring prompt." },
		{ flag: "--target-path <path>", description: "Optional target path." },
		{ flag: "--template <name>", description: "Template or template path." },
		{ flag: "--mode <analyze|generate|write>", description: "Authoring mode." },
		{ flag: "--include-recommendations", description: "Request recommendations." },
		{ flag: "--include-gap-analysis", description: "Request gap analysis." },
		{ flag: "--include-completeness-analysis", description: "Request completeness analysis." },
		{ flag: "--include-consistency-analysis", description: "Request consistency analysis." },
		{ flag: "--validate-before-write", description: "Validate before writing." },
		{ flag: "--json", description: "Emit machine-readable output." },
	],
	sections: [
		{
			title: "Behavior",
			lines: [
				"Create uses maintained templates and prompts for deterministic skill authoring.",
				"Validation can run before write when requested.",
			],
		},
	],
	examples: [
		'mimirmesh skills create --prompt "Create a new skill for repository-local code navigation guidance."',
		"mimirmesh skills create --mode write --validate-before-write",
	],
};

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function SkillsCreateCommand({
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
			definition={createSkillsCreateWorkflow({
				prompt: options.prompt,
				targetPath: options.targetPath,
				template: options.template,
				mode: options.mode,
				includeRecommendations: options.includeRecommendations,
				includeGapAnalysis: options.includeGapAnalysis,
				includeCompletenessAnalysis: options.includeCompletenessAnalysis,
				includeConsistencyAnalysis: options.includeConsistencyAnalysis,
				validateBeforeWrite: options.validateBeforeWrite,
			})}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
