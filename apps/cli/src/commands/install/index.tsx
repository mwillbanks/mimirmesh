import {
	createInstallationAreas,
	createInstallationPolicy,
	type InstallAreaId,
	type InstallPresetId,
	type InstallTarget,
	installPresetCatalog,
	installTargetCatalog,
	isInstallAreaId,
	isInstallPresetId,
	resolveInstallAreas,
	validateInstallationPolicy,
} from "@mimirmesh/installer";
import { bundledSkillNames } from "@mimirmesh/skills";
import {
	GuidedMultiSelect,
	GuidedSelect,
	type PresentationProfile,
	type WorkflowDefinition,
	type WorkflowRunState,
} from "@mimirmesh/ui";
import { Box, Text } from "ink";
import { useEffect, useMemo, useState } from "react";
import zod from "zod/v4";

import { CommandHelpView } from "../../lib/command-help";
import { CommandRunner } from "../../lib/command-runner";
import { loadCliPreviewContext, previewInstallExecution } from "../../lib/context";
import { createGuardedWorkflow } from "../../lib/guarded-workflow";
import { installCommandHelp } from "../../lib/install-help";
import { getPromptGuardError } from "../../lib/non-interactive";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";
import { InstallReview } from "../../ui/install-review";
import { createInstallWorkflow } from "../../workflows/install";

export const options = withPresentationOptions(
	{
		preset: zod.string().optional(),
		areas: zod.string().optional().describe("Comma-separated install areas"),
		ide: zod.string().optional().describe("Comma-separated IDE targets"),
		skills: zod.string().optional().describe("Comma-separated bundled skill names or `all`"),
		yes: zod.boolean().optional().describe("Auto-confirm install-managed updates"),
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

const parseList = (value?: string): string[] =>
	value
		?.split(",")
		.map((item) => item.trim())
		.filter(Boolean) ?? [];

const blockedInstallDefinition = (
	message: string,
	impact: string,
	nextAction: string,
	kind: "failed" | "degraded" = "failed",
): WorkflowDefinition => ({
	id: "install",
	title: "Install MímirMesh",
	description:
		"Guide repository installation, optional integrations, and final readiness verification through one workflow.",
	category: "setup",
	entryModes: ["tui-launcher", "direct-command"],
	interactivePolicy: "default-interactive",
	machineReadableSupported: true,
	requiresProjectContext: true,
	recommendedNextActions: ["runtime-status", "install-ide", "skills-install"],
	steps: [{ id: "guard", label: "Validate install request", kind: "validation" }],
	execute: async () => ({
		kind,
		message,
		impact,
		completedWork: [],
		blockedCapabilities: ["Unified install workflow"],
		nextAction,
	}),
});

const installPresetChoices = installPresetCatalog.map((preset) => ({
	label: preset.label,
	value: preset.id,
	description: preset.description,
	recommended: preset.recommended,
}));

export const help = installCommandHelp;

export default function InstallCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const resolvedPresentation = presentation ?? resolvePresentationProfile(options);
	const requestedAreas = useMemo(() => parseList(options.areas), [options.areas]);
	const requestedIdeTargets = useMemo(() => parseList(options.ide), [options.ide]);
	const requestedSkills = useMemo(() => parseList(options.skills), [options.skills]);
	const invalidPreset =
		options.preset && !isInstallPresetId(options.preset) ? options.preset : null;
	const invalidAreas = useMemo(
		() => requestedAreas.filter((area) => !isInstallAreaId(area)),
		[requestedAreas],
	);
	const invalidIdeTargets = useMemo(
		() =>
			requestedIdeTargets.filter(
				(target) => !installTargetCatalog.includes(target as InstallTarget),
			),
		[requestedIdeTargets],
	);
	const invalidSkills = useMemo(
		() =>
			requestedSkills.filter(
				(skill) =>
					skill !== "all" &&
					!bundledSkillNames.includes(skill as (typeof bundledSkillNames)[number]),
			),
		[requestedSkills],
	);
	const promptError = getPromptGuardError({
		command: "`mimirmesh install`",
		presentation: resolvedPresentation,
		interactivePolicy: "default-interactive",
		explicitNonInteractive: options.nonInteractive,
	});

	const explicitAreas = useMemo(() => requestedAreas.filter(isInstallAreaId), [requestedAreas]);
	const explicitIdeTargets = useMemo(
		() =>
			requestedIdeTargets.filter((target): target is InstallTarget =>
				installTargetCatalog.includes(target as InstallTarget),
			),
		[requestedIdeTargets],
	);
	const explicitSkills = useMemo(
		() =>
			requestedSkills.includes("all")
				? [...bundledSkillNames]
				: requestedSkills.filter((skill): skill is (typeof bundledSkillNames)[number] =>
						bundledSkillNames.includes(skill as (typeof bundledSkillNames)[number]),
					),
		[requestedSkills],
	);

	const [selectedPreset, setSelectedPreset] = useState<InstallPresetId | null>(
		options.preset && isInstallPresetId(options.preset) ? options.preset : null,
	);
	const [selectedAreas, setSelectedAreas] = useState<InstallAreaId[] | null>(
		explicitAreas.length > 0 ? explicitAreas : null,
	);
	const [selectedIdeTargets, setSelectedIdeTargets] = useState<InstallTarget[] | null>(
		explicitIdeTargets.length > 0 ? explicitIdeTargets : null,
	);
	const [selectedSkills, setSelectedSkills] = useState<string[] | null>(
		explicitSkills.length > 0 ? explicitSkills : null,
	);
	const [preview, setPreview] = useState<Awaited<
		ReturnType<typeof previewInstallExecution>
	> | null>(null);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);
	const [overwriteDeclined, setOverwriteDeclined] = useState(false);

	const effectivePreset = (
		options.preset && isInstallPresetId(options.preset) ? options.preset : selectedPreset
	) as InstallPresetId | null;
	const effectiveAreas = useMemo(
		() =>
			explicitAreas.length
				? explicitAreas
				: (selectedAreas ?? (effectivePreset ? resolveInstallAreas(effectivePreset) : null)),
		[effectivePreset, explicitAreas, selectedAreas],
	);
	const effectiveIdeTargets = useMemo(
		() => (explicitIdeTargets.length > 0 ? explicitIdeTargets : (selectedIdeTargets ?? [])),
		[explicitIdeTargets, selectedIdeTargets],
	);
	const effectiveSkills = useMemo(
		() => (explicitSkills.length ? explicitSkills : (selectedSkills ?? [])),
		[explicitSkills, selectedSkills],
	);

	const installPolicy = useMemo(() => {
		if (!effectiveAreas || (!effectivePreset && effectiveAreas.length === 0)) {
			return null;
		}
		return createInstallationPolicy({
			presetId: effectivePreset ?? undefined,
			selectedAreas: effectiveAreas,
			explicitAreaOverrides: explicitAreas.length > 0 ? explicitAreas : effectiveAreas,
			mode: options.nonInteractive ? "non-interactive" : "interactive",
			ideTargets: effectiveIdeTargets,
			selectedSkills: effectiveSkills,
		});
	}, [
		effectiveAreas,
		effectiveIdeTargets,
		effectivePreset,
		effectiveSkills,
		explicitAreas,
		options.nonInteractive,
	]);

	useEffect(() => {
		if (options.help || !installPolicy) {
			return;
		}

		let cancelled = false;
		setPreview(null);
		setPreviewError(null);
		setOverwriteConfirmed(false);
		setOverwriteDeclined(false);
		void loadCliPreviewContext()
			.then((context) => previewInstallExecution(context, installPolicy))
			.then((result) => {
				if (cancelled) {
					return;
				}
				setPreview(result);
				if (result.summary.updatedFiles.length === 0) {
					setOverwriteConfirmed(true);
				}
			})
			.catch((error) => {
				if (!cancelled) {
					setPreviewError(error instanceof Error ? error.message : String(error));
				}
			});

		return () => {
			cancelled = true;
		};
	}, [options.help, installPolicy]);

	if (options.help) {
		return <CommandHelpView definition={help} />;
	}

	if (invalidPreset) {
		return (
			<CommandRunner
				definition={blockedInstallDefinition(
					`Unknown install preset: ${invalidPreset}.`,
					"Install did not begin because the requested preset is not supported.",
					"Re-run `mimirmesh install` and choose one of: minimal, recommended, full.",
				)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	if (invalidAreas.length > 0) {
		return (
			<CommandRunner
				definition={blockedInstallDefinition(
					`Unknown install area(s): ${invalidAreas.join(", ")}.`,
					"Install did not begin because one or more requested install areas are unsupported.",
					"Re-run `mimirmesh install` with `--areas core,ide,skills`.",
				)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	if (invalidIdeTargets.length > 0) {
		return (
			<CommandRunner
				definition={blockedInstallDefinition(
					`Unknown IDE target(s): ${invalidIdeTargets.join(", ")}.`,
					"Install did not begin because one or more requested IDE targets are unsupported.",
					"Re-run `mimirmesh install --ide vscode,cursor,claude,codex` with valid targets.",
				)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	if (invalidSkills.length > 0) {
		return (
			<CommandRunner
				definition={blockedInstallDefinition(
					`Unknown bundled skill(s): ${invalidSkills.join(", ")}.`,
					"Install did not begin because one or more requested bundled skills are unsupported.",
					"Re-run `mimirmesh install --skills all` or choose valid bundled skill names.",
				)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	if (!effectivePreset && explicitAreas.length === 0 && promptError) {
		return (
			<CommandRunner
				definition={createGuardedWorkflow(
					blockedInstallDefinition(
						promptError,
						"The unified installer needs an interactive terminal or an explicit automation-safe invocation.",
						"Re-run `mimirmesh install --non-interactive --preset recommended` or use an interactive terminal.",
					),
					promptError,
					"The unified installer did not begin because it needs guidance in an interactive terminal or explicit automation-safe choices.",
					["Unified install workflow"],
					"Re-run `mimirmesh install --non-interactive --preset recommended` or use an interactive terminal.",
				)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	if (!effectivePreset && explicitAreas.length === 0 && resolvedPresentation.interactive) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Install MímirMesh</Text>
				<GuidedSelect
					title="Choose an installation preset"
					reason="The installer starts from a preset so the operator can review a clear recommended baseline before making adjustments."
					consequence="The selected preset preselects the install areas that will be reviewed next."
					nonInteractiveFallback="mimirmesh install --non-interactive --preset recommended"
					choices={installPresetChoices}
					defaultValue="recommended"
					onSubmit={(value) => {
						if (isInstallPresetId(value)) {
							setSelectedPreset(value);
						}
					}}
				/>
			</Box>
		);
	}

	if (
		!explicitAreas.length &&
		effectivePreset &&
		selectedAreas === null &&
		resolvedPresentation.interactive
	) {
		const installAreas = createInstallationAreas(resolveInstallAreas(effectivePreset));
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Review install areas</Text>
				<GuidedMultiSelect
					title="Choose install areas"
					reason="The preset provides a starting point, but you can confirm or adjust the install areas before any changes are applied."
					consequence="Required areas stay enabled. Optional areas can be skipped or included for this run."
					nonInteractiveFallback="mimirmesh install --non-interactive --preset recommended --areas core,skills"
					choices={installAreas.map((area) => ({
						label: area.label,
						value: area.id,
						description: area.description,
						recommended: area.selectionState === "required" || area.selectionState === "selected",
					}))}
					defaultValues={resolveInstallAreas(effectivePreset)}
					onSubmit={(values) => {
						setSelectedAreas(values.filter(isInstallAreaId));
					}}
				/>
			</Box>
		);
	}

	if (
		installPolicy?.selectedAreas.includes("ide") &&
		effectiveIdeTargets.length === 0 &&
		resolvedPresentation.interactive
	) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Choose IDE integrations</Text>
				<GuidedMultiSelect
					title="Select IDEs or agents"
					reason="Install should support every IDE or agent the operator actually uses instead of forcing a single target."
					consequence="Each selected target receives a new or updated project-local `mcp.json` entry for the `mimirmesh` server."
					nonInteractiveFallback="mimirmesh install --non-interactive --preset full --ide vscode,cursor"
					choices={[
						{
							label: "VS Code",
							value: "vscode",
							description: "Write `.vscode/mcp.json` for the local project.",
							recommended: true,
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
					]}
					defaultValues={["vscode"]}
					onSubmit={(values) => {
						setSelectedIdeTargets(
							values.filter((value): value is InstallTarget =>
								installTargetCatalog.includes(value as InstallTarget),
							),
						);
					}}
				/>
			</Box>
		);
	}

	if (
		installPolicy?.selectedAreas.includes("skills") &&
		explicitSkills.length === 0 &&
		selectedSkills === null &&
		resolvedPresentation.interactive
	) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Choose bundled skills</Text>
				<GuidedMultiSelect
					title="Select bundled skills to install"
					reason="Bundled skills are installable as part of onboarding so the repository-local agent surface is ready immediately."
					consequence="Selected skills will be installed under `.agents/skills/` using the configured install mode."
					nonInteractiveFallback="mimirmesh install --non-interactive --preset recommended --skills all"
					choices={bundledSkillNames.map((name) => ({
						label: name,
						value: name,
						description: "Install this bundled repository-local skill.",
						recommended: true,
					}))}
					defaultValues={[...bundledSkillNames]}
					onSubmit={(values) => {
						setSelectedSkills(values);
					}}
				/>
			</Box>
		);
	}

	if (!installPolicy) {
		return (
			<CommandRunner
				definition={blockedInstallDefinition(
					"Install requires a preset or explicit install-area selections.",
					"The unified installer did not begin because it could not resolve an install policy.",
					"Re-run `mimirmesh install --non-interactive --preset recommended` or use an interactive terminal.",
				)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	const validation = validateInstallationPolicy(installPolicy);
	if (!validation.ok) {
		return (
			<CommandRunner
				definition={blockedInstallDefinition(
					validation.errors.join(" "),
					"The unified installer did not begin because the non-interactive request was incomplete.",
					"Provide an explicit preset or install areas, and include `--ide <target[,target]>` when IDE integration is selected.",
				)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	if (overwriteDeclined) {
		return (
			<CommandRunner
				definition={blockedInstallDefinition(
					"Install was cancelled before updating existing install-managed files.",
					"The current repository state was left unchanged.",
					"Re-run `mimirmesh install` if you want to review the install plan again.",
					"degraded",
				)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	if (previewError) {
		return (
			<CommandRunner
				definition={blockedInstallDefinition(
					previewError,
					"The installer could not compute the current install plan.",
					"Resolve the reported issue and re-run `mimirmesh install`.",
				)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	if (!preview) {
		if (resolvedPresentation.mode === "direct-machine") {
			return null;
		}
		return (
			<Box>
				<Text>Loading install state…</Text>
			</Box>
		);
	}

	if (options.nonInteractive && preview.summary.updatedFiles.length > 0 && !options.yes) {
		return (
			<CommandRunner
				definition={blockedInstallDefinition(
					"Non-interactive install cannot overwrite existing install-managed files unless you review them interactively or pass `--yes`.",
					"The repository was left unchanged because the install plan includes updates that need operator confirmation.",
					"Re-run `mimirmesh install` interactively to review the pending changes, or use `--yes` to auto-confirm them in non-interactive mode.",
				)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	if (
		resolvedPresentation.interactive &&
		preview.summary.updatedFiles.length > 0 &&
		!overwriteConfirmed
	) {
		return (
			<InstallReview
				snapshot={preview.snapshot}
				summary={preview.summary}
				onConfirm={() => {
					setOverwriteConfirmed(true);
				}}
				onCancel={() => {
					setOverwriteDeclined(true);
				}}
			/>
		);
	}

	return (
		<CommandRunner
			definition={createInstallWorkflow({
				autoConfirmManagedUpdates: Boolean(options.yes),
				policy: installPolicy,
				confirmedUpdatedFiles: preview.summary.updatedFiles,
				plannedPreview: preview,
			})}
			presentation={resolvedPresentation}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
