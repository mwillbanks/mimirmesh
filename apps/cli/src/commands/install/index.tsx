import {
	createDefaultEmbeddingsInstallConfig,
	createInstallationAreas,
	createInstallationPolicy,
	defaultDockerLlamaCppModel,
	defaultLmStudioBaseUrl,
	defaultLmStudioModel,
	defaultOpenAIModel,
	type EmbeddingsInstallMode,
	type InstallAreaId,
	type InstallPresetId,
	type InstallTarget,
	installPresetCatalog,
	installTargetCatalog,
	isEmbeddingsInstallMode,
	isInstallAreaId,
	isInstallPresetId,
	resolveEmbeddingsInstallConfig,
	resolveInstallAreas,
	validateInstallationPolicy,
} from "@mimirmesh/installer";
import { bundledSkillNames } from "@mimirmesh/skills";
import {
	GuidedMultiSelect,
	GuidedSelect,
	GuidedTextInput,
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
		embeddings: zod
			.string()
			.optional()
			.describe(
				"Embeddings setup strategy: disabled, docker-llama-cpp, existing-lm-studio, existing-openai-compatible, openai",
			),
		embeddingsBaseUrl: zod.string().optional().describe("Embeddings runtime base URL"),
		embeddingsModel: zod.string().optional().describe("Embeddings model identifier"),
		embeddingsApiKey: zod.string().optional().describe("Embeddings provider API key"),
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

const embeddingsModeChoices: Array<{
	label: string;
	value: EmbeddingsInstallMode;
	description: string;
	recommended?: boolean;
}> = [
	{
		label: "Docker-managed llama.cpp",
		value: "docker-llama-cpp",
		description:
			"Build and run a repository-scoped llama.cpp embeddings service through Docker Compose.",
		recommended: true,
	},
	{
		label: "Existing LM Studio runtime",
		value: "existing-lm-studio",
		description:
			"Use an already running LM Studio OpenAI-compatible embeddings endpoint instead of Docker-managed llama.cpp.",
	},
	{
		label: "Existing OpenAI-compatible runtime",
		value: "existing-openai-compatible",
		description:
			"Use an already running OpenAI-compatible embeddings endpoint that is managed outside MímirMesh.",
	},
	{
		label: "OpenAI API",
		value: "openai",
		description: "Use the hosted OpenAI embeddings API with a supplied API key.",
	},
	{
		label: "Disabled",
		value: "disabled",
		description: "Skip embeddings setup and keep deterministic lexical and explicit matching only.",
	},
];

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
	const invalidEmbeddingsMode =
		options.embeddings && !isEmbeddingsInstallMode(options.embeddings) ? options.embeddings : null;
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
	const explicitEmbeddingsMode =
		options.embeddings && isEmbeddingsInstallMode(options.embeddings) ? options.embeddings : null;

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
	const [selectedEmbeddingsMode, setSelectedEmbeddingsMode] =
		useState<EmbeddingsInstallMode | null>(explicitEmbeddingsMode);
	const [selectedEmbeddingsModel, setSelectedEmbeddingsModel] = useState<string | null>(
		options.embeddingsModel ?? null,
	);
	const [selectedEmbeddingsBaseUrl, setSelectedEmbeddingsBaseUrl] = useState<string | null>(
		options.embeddingsBaseUrl ?? null,
	);
	const [selectedEmbeddingsApiKey, setSelectedEmbeddingsApiKey] = useState<string | null>(
		options.embeddingsApiKey ?? null,
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
	const effectiveEmbeddings = useMemo(
		() =>
			resolveEmbeddingsInstallConfig({
				presetId: effectivePreset ?? undefined,
				selectedAreas: effectiveAreas ?? [],
				embeddings: {
					mode: explicitEmbeddingsMode ?? selectedEmbeddingsMode ?? undefined,
					model: options.embeddingsModel ?? selectedEmbeddingsModel ?? undefined,
					baseUrl: options.embeddingsBaseUrl ?? selectedEmbeddingsBaseUrl ?? undefined,
					apiKey: options.embeddingsApiKey ?? selectedEmbeddingsApiKey ?? undefined,
					fallbackOnFailure: true,
				},
			}),
		[
			effectiveAreas,
			effectivePreset,
			explicitEmbeddingsMode,
			options.embeddingsApiKey,
			options.embeddingsBaseUrl,
			options.embeddingsModel,
			selectedEmbeddingsApiKey,
			selectedEmbeddingsBaseUrl,
			selectedEmbeddingsMode,
			selectedEmbeddingsModel,
		],
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
			embeddings: effectiveEmbeddings,
		});
	}, [
		effectiveEmbeddings,
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

	if (invalidEmbeddingsMode) {
		return (
			<CommandRunner
				definition={blockedInstallDefinition(
					`Unknown embeddings strategy: ${invalidEmbeddingsMode}.`,
					"Install did not begin because the requested embeddings setup strategy is unsupported.",
					"Re-run `mimirmesh install --embeddings disabled|docker-llama-cpp|existing-lm-studio|existing-openai-compatible|openai`.",
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

	if (
		(effectiveAreas?.includes("skills") ?? false) &&
		!explicitEmbeddingsMode &&
		selectedEmbeddingsMode === null &&
		resolvedPresentation.interactive
	) {
		const defaultEmbeddingsMode = createDefaultEmbeddingsInstallConfig(
			effectivePreset ?? undefined,
		).mode;
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Choose an embeddings setup strategy</Text>
				<GuidedSelect
					title="Select embeddings setup"
					reason="Embeddings setup is a first-class installer decision because some repositories want Docker-managed local hosting while others already have a compatible runtime available."
					consequence="The selected strategy determines whether install writes a Docker-managed llama.cpp provider, an external runtime endpoint, a hosted API configuration, or keeps embeddings disabled."
					nonInteractiveFallback="mimirmesh install --non-interactive --preset recommended --embeddings docker-llama-cpp"
					choices={embeddingsModeChoices}
					defaultValue={defaultEmbeddingsMode}
					onSubmit={(value) => {
						if (isEmbeddingsInstallMode(value)) {
							setSelectedEmbeddingsMode(value);
						}
					}}
				/>
			</Box>
		);
	}

	if (
		effectiveEmbeddings.mode === "docker-llama-cpp" &&
		options.embeddingsModel === undefined &&
		selectedEmbeddingsModel === null &&
		resolvedPresentation.interactive
	) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Configure Docker-managed llama.cpp embeddings</Text>
				<GuidedTextInput
					title="Choose the llama.cpp embedding model"
					reason="Docker-managed llama.cpp still needs a concrete embedding model so the generated runtime can start in a usable state immediately after install."
					consequence="The selected model is persisted into `.mimirmesh/config.yml` and used when the Compose-managed embeddings runtime is rendered."
					nonInteractiveFallback="mimirmesh install --non-interactive --preset recommended --embeddings docker-llama-cpp --embeddings-model Qwen/Qwen3-Embedding-0.6B-GGUF"
					label="Embedding model"
					initialValue={defaultDockerLlamaCppModel}
					onSubmit={(value) => {
						setSelectedEmbeddingsModel(value);
					}}
				/>
			</Box>
		);
	}

	if (
		effectiveEmbeddings.mode === "existing-lm-studio" &&
		options.embeddingsBaseUrl === undefined &&
		selectedEmbeddingsBaseUrl === null &&
		resolvedPresentation.interactive
	) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Configure the LM Studio embeddings endpoint</Text>
				<GuidedTextInput
					title="Enter the LM Studio base URL"
					reason="MímirMesh needs the exact OpenAI-compatible endpoint for the existing LM Studio runtime so install does not force a Docker-managed deployment."
					consequence="The base URL is persisted into `.mimirmesh/config.yml` and used directly during refresh and resolve embedding calls."
					nonInteractiveFallback="mimirmesh install --non-interactive --preset recommended --embeddings existing-lm-studio --embeddings-base-url http://localhost:1234/v1"
					label="LM Studio base URL"
					initialValue={defaultLmStudioBaseUrl}
					onSubmit={(value) => {
						setSelectedEmbeddingsBaseUrl(value);
					}}
				/>
			</Box>
		);
	}

	if (
		effectiveEmbeddings.mode === "existing-lm-studio" &&
		options.embeddingsModel === undefined &&
		selectedEmbeddingsModel === null &&
		resolvedPresentation.interactive
	) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Choose the LM Studio embeddings model</Text>
				<GuidedTextInput
					title="Enter the LM Studio embeddings model"
					reason="The installer must persist the model name for an existing compatible runtime so embeddings can be used immediately after install."
					consequence="The selected model is written into `.mimirmesh/config.yml` for the LM Studio provider."
					nonInteractiveFallback="mimirmesh install --non-interactive --preset recommended --embeddings existing-lm-studio --embeddings-model text-embedding-nomic-embed-text-v1.5"
					label="LM Studio model"
					initialValue={defaultLmStudioModel}
					onSubmit={(value) => {
						setSelectedEmbeddingsModel(value);
					}}
				/>
			</Box>
		);
	}

	if (
		effectiveEmbeddings.mode === "existing-lm-studio" &&
		options.embeddingsApiKey === undefined &&
		selectedEmbeddingsApiKey === null &&
		resolvedPresentation.interactive
	) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Optional LM Studio API key</Text>
				<GuidedTextInput
					title="Enter an LM Studio API key if the server requires one"
					reason="Some LM Studio setups now enforce bearer auth, so install needs a way to persist that value without forcing it for every local runtime."
					consequence="Leaving this blank keeps the provider unauthenticated. Supplying a value persists it into `.mimirmesh/config.yml`."
					nonInteractiveFallback="mimirmesh install --non-interactive --preset recommended --embeddings existing-lm-studio --embeddings-api-key <token>"
					label="LM Studio API key"
					placeholder="Leave blank if not required"
					mask
					allowEmpty
					onSubmit={(value) => {
						setSelectedEmbeddingsApiKey(value);
					}}
				/>
			</Box>
		);
	}

	if (
		effectiveEmbeddings.mode === "existing-openai-compatible" &&
		options.embeddingsBaseUrl === undefined &&
		selectedEmbeddingsBaseUrl === null &&
		resolvedPresentation.interactive
	) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Configure the existing OpenAI-compatible embeddings endpoint</Text>
				<GuidedTextInput
					title="Enter the embeddings base URL"
					reason="External OpenAI-compatible runtimes are supported, but the installer has to persist the exact endpoint instead of assuming Docker-managed hosting."
					consequence="The base URL is written into `.mimirmesh/config.yml` for the external embeddings provider."
					nonInteractiveFallback="mimirmesh install --non-interactive --preset recommended --embeddings existing-openai-compatible --embeddings-base-url https://example.invalid/v1"
					label="Embeddings base URL"
					placeholder="https://example.invalid/v1"
					onSubmit={(value) => {
						setSelectedEmbeddingsBaseUrl(value);
					}}
				/>
			</Box>
		);
	}

	if (
		effectiveEmbeddings.mode === "existing-openai-compatible" &&
		options.embeddingsModel === undefined &&
		selectedEmbeddingsModel === null &&
		resolvedPresentation.interactive
	) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Choose the external embeddings model</Text>
				<GuidedTextInput
					title="Enter the embeddings model"
					reason="An existing OpenAI-compatible runtime still needs an explicit model name so the configured provider can be used immediately after install."
					consequence="The model is written into `.mimirmesh/config.yml` for the external embeddings provider."
					nonInteractiveFallback="mimirmesh install --non-interactive --preset recommended --embeddings existing-openai-compatible --embeddings-model text-embedding-model"
					label="Embeddings model"
					placeholder="text-embedding-model"
					onSubmit={(value) => {
						setSelectedEmbeddingsModel(value);
					}}
				/>
			</Box>
		);
	}

	if (
		effectiveEmbeddings.mode === "existing-openai-compatible" &&
		options.embeddingsApiKey === undefined &&
		selectedEmbeddingsApiKey === null &&
		resolvedPresentation.interactive
	) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Enter the external embeddings API key</Text>
				<GuidedTextInput
					title="Enter the API key"
					reason="OpenAI-compatible remote runtimes require a persisted API key so the configured embeddings provider is usable immediately after install."
					consequence="The API key is written into `.mimirmesh/config.yml` for the external embeddings provider."
					nonInteractiveFallback="mimirmesh install --non-interactive --preset recommended --embeddings existing-openai-compatible --embeddings-api-key <token>"
					label="Embeddings API key"
					mask
					onSubmit={(value) => {
						setSelectedEmbeddingsApiKey(value);
					}}
				/>
			</Box>
		);
	}

	if (
		effectiveEmbeddings.mode === "openai" &&
		options.embeddingsModel === undefined &&
		selectedEmbeddingsModel === null &&
		resolvedPresentation.interactive
	) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Choose the OpenAI embeddings model</Text>
				<GuidedTextInput
					title="Enter the OpenAI embeddings model"
					reason="Hosted OpenAI embeddings still need an explicit model selection so the configured provider is deterministic and reviewable."
					consequence="The selected model is written into `.mimirmesh/config.yml` for the OpenAI provider."
					nonInteractiveFallback="mimirmesh install --non-interactive --preset recommended --embeddings openai --embeddings-model text-embedding-3-small --embeddings-api-key <token>"
					label="OpenAI embeddings model"
					initialValue={defaultOpenAIModel}
					onSubmit={(value) => {
						setSelectedEmbeddingsModel(value);
					}}
				/>
			</Box>
		);
	}

	if (
		effectiveEmbeddings.mode === "openai" &&
		options.embeddingsApiKey === undefined &&
		selectedEmbeddingsApiKey === null &&
		resolvedPresentation.interactive
	) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Enter the OpenAI API key</Text>
				<GuidedTextInput
					title="Enter the OpenAI API key"
					reason="The OpenAI provider cannot be used after install unless the API key is collected and persisted with the provider configuration."
					consequence="The API key is written into `.mimirmesh/config.yml` for the OpenAI embeddings provider."
					nonInteractiveFallback="mimirmesh install --non-interactive --preset recommended --embeddings openai --embeddings-api-key <token>"
					label="OpenAI API key"
					mask
					onSubmit={(value) => {
						setSelectedEmbeddingsApiKey(value);
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
