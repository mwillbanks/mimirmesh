import { GuidedMultiSelect, type PresentationProfile, type WorkflowRunState } from "@mimirmesh/ui";
import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import type zod from "zod/v4";
import z from "zod/v4";

import { type CommandHelpDefinition, CommandHelpView } from "../../lib/command-help";
import { CommandRunner } from "../../lib/command-runner";
import { createGuardedWorkflow } from "../../lib/guarded-workflow";
import { getPromptGuardError } from "../../lib/non-interactive";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";
import {
	createSkillsAuthoringUpdateWorkflow,
	createSkillsUpdateWorkflow,
} from "../../workflows/skills";
import {
	buildSkillAuthoringPrompt,
	loadSkillSelectionModel,
	resolveSkillUpdateInvocationMode,
	skillNameArgs,
} from "./shared";

export const args = skillNameArgs;
export const options = withPresentationOptions(
	{
		prompt: z.string().optional().describe("Authoring prompt for non-bundled skill updates"),
		targetPath: z.string().optional().describe("Optional update target path"),
		template: z.string().optional().describe("Optional template name or path"),
		mode: z
			.enum(["analyze", "patchPlan", "write"])
			.optional()
			.describe("Authoring mode for existing-skill updates"),
		includeRecommendations: z.boolean().optional(),
		includeGapAnalysis: z.boolean().optional(),
		includeCompletenessAnalysis: z.boolean().optional(),
		includeConsistencyAnalysis: z.boolean().optional(),
		validateBeforeWrite: z.boolean().optional(),
		validateAfterWrite: z.boolean().optional(),
	},
	{ allowNonInteractive: true },
);

export const help: CommandHelpDefinition = {
	title: "mimirmesh skills update",
	usage: "mimirmesh skills update [skill-name] [flags]",
	flags: [
		{ flag: "--prompt <text>", description: "Authoring prompt for update mode." },
		{ flag: "--target-path <path>", description: "Optional update target path." },
		{ flag: "--template <name>", description: "Template or template path to reuse." },
		{ flag: "--mode <analyze|patchPlan|write>", description: "Authoring mode." },
		{ flag: "--include-recommendations", description: "Request recommendations." },
		{ flag: "--include-gap-analysis", description: "Request gap analysis." },
		{ flag: "--include-completeness-analysis", description: "Request completeness analysis." },
		{ flag: "--include-consistency-analysis", description: "Request consistency analysis." },
		{ flag: "--validate-before-write", description: "Validate before writing." },
		{ flag: "--validate-after-write", description: "Validate after writing." },
		{ flag: "--json", description: "Emit machine-readable output." },
	],
	sections: [
		{
			title: "Modes",
			lines: [
				"`mimirmesh skills update` keeps the bundled-skill maintenance flow.",
				"`mimirmesh skills update <skill-name>` switches to the authoring surface when the name is not a bundled skill.",
			],
		},
	],
	examples: [
		"mimirmesh skills update",
		'mimirmesh skills update mimirmesh-code-navigation --prompt "Refine the code navigation skill for new discovery rules."',
	],
};

type Props = {
	args?: zod.infer<typeof args>;
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function SkillsUpdateCommand({
	args = [],
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const resolvedPresentation = presentation ?? resolvePresentationProfile(options);
	const selectedSkill = args[0];
	const updateMode = resolveSkillUpdateInvocationMode(selectedSkill);
	const baseDefinition =
		updateMode.mode === "authoring" && updateMode.skillName
			? createSkillsAuthoringUpdateWorkflow({
					name: updateMode.skillName,
					prompt: options.prompt ?? buildSkillAuthoringPrompt("update", updateMode.skillName),
					targetPath: options.targetPath,
					template: options.template,
					mode: options.mode,
					includeRecommendations: options.includeRecommendations,
					includeGapAnalysis: options.includeGapAnalysis,
					includeCompletenessAnalysis: options.includeCompletenessAnalysis,
					includeConsistencyAnalysis: options.includeConsistencyAnalysis,
					validateBeforeWrite: options.validateBeforeWrite,
					validateAfterWrite: options.validateAfterWrite,
				})
			: createSkillsUpdateWorkflow(selectedSkill ? [selectedSkill] : undefined);
	const promptError = getPromptGuardError({
		command: "`mimirmesh skills update [skill-name]`",
		presentation: resolvedPresentation,
		interactivePolicy: "default-interactive",
		explicitNonInteractive: options.nonInteractive,
	});
	const [selectionModel, setSelectionModel] = useState<Awaited<
		ReturnType<typeof loadSkillSelectionModel>
	> | null>(null);
	const [selection, setSelection] = useState<string[] | null>(null);
	const [selectionError, setSelectionError] = useState<string | null>(null);

	useEffect(() => {
		if (selectedSkill || !resolvedPresentation.interactive || updateMode.mode === "authoring") {
			return;
		}

		let cancelled = false;
		void loadSkillSelectionModel("update")
			.then((model) => {
				if (!cancelled) {
					setSelectionModel(model);
				}
			})
			.catch((error) => {
				if (!cancelled) {
					setSelectionError(error instanceof Error ? error.message : String(error));
				}
			});

		return () => {
			cancelled = true;
		};
	}, [resolvedPresentation.interactive, selectedSkill, updateMode.mode]);

	if (options.help) {
		return <CommandHelpView definition={help} />;
	}

	if (updateMode.mode === "authoring" && updateMode.skillName) {
		return (
			<CommandRunner
				definition={baseDefinition}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	if (!selectedSkill && promptError) {
		return (
			<CommandRunner
				definition={createGuardedWorkflow(
					baseDefinition,
					promptError,
					"Skill update did not begin because this workflow needs either an explicit automation-safe invocation or an interactive selection.",
					["Repository-local bundled skill updates"],
					"Re-run `mimirmesh skills update --non-interactive` to refresh all outdated installed skills or use an interactive terminal.",
				)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	if (!selectedSkill && resolvedPresentation.interactive && selection === null) {
		if (selectionError) {
			return (
				<CommandRunner
					definition={createGuardedWorkflow(
						baseDefinition,
						selectionError,
						"The installed bundled skill inventory could not be loaded for interactive selection.",
						[],
						"Re-run `mimirmesh skills update --non-interactive` or resolve the bundled skill asset problem.",
					)}
					presentation={resolvedPresentation}
					exitOnComplete={exitOnComplete}
					onComplete={onComplete}
				/>
			);
		}

		if (!selectionModel) {
			return (
				<Box>
					<Text>Loading installed bundled skills…</Text>
				</Box>
			);
		}

		if (selectionModel.choices.length === 0) {
			return (
				<CommandRunner
					definition={createSkillsUpdateWorkflow([])}
					presentation={resolvedPresentation}
					exitOnComplete={exitOnComplete}
					onComplete={onComplete}
				/>
			);
		}

		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Update Bundled Skills</Text>
				<GuidedMultiSelect
					title="Choose installed skills to update"
					reason="Only installed bundled skills that are currently out of date are shown."
					consequence="Selected outdated skills will be refreshed using the current global install mode."
					nonInteractiveFallback="mimirmesh skills update --non-interactive"
					choices={selectionModel.choices}
					defaultValues={selectionModel.defaultValues}
					onSubmit={(values) => {
						setSelection(values);
					}}
				/>
			</Box>
		);
	}

	return (
		<CommandRunner
			definition={createSkillsUpdateWorkflow(
				selection ?? (selectedSkill ? [selectedSkill] : undefined),
			)}
			presentation={resolvedPresentation}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
