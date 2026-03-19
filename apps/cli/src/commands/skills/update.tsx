import { GuidedMultiSelect, type PresentationProfile, type WorkflowRunState } from "@mimirmesh/ui";
import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import type zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { createGuardedWorkflow } from "../../lib/guarded-workflow";
import { getPromptGuardError } from "../../lib/non-interactive";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";
import { createSkillsUpdateWorkflow } from "../../workflows/skills";
import { isKnownBundledSkill, loadSkillSelectionModel, skillNameArgs } from "./shared";

export const args = skillNameArgs;
export const options = withPresentationOptions({}, { allowNonInteractive: true });

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
	const baseDefinition = createSkillsUpdateWorkflow(selectedSkill ? [selectedSkill] : undefined);
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
		if (selectedSkill || !resolvedPresentation.interactive) {
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
	}, [resolvedPresentation.interactive, selectedSkill]);

	if (selectedSkill && !isKnownBundledSkill(selectedSkill)) {
		return (
			<CommandRunner
				definition={createGuardedWorkflow(
					baseDefinition,
					`Unknown bundled skill: ${selectedSkill}.`,
					"No skills were updated.",
					[],
					"Run `mimirmesh skills update` to choose from the installed bundled skills interactively.",
				)}
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
