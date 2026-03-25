export type InstallAreaId = "core" | "ide" | "skills";

export type InstallAreaKind = "required" | "optional";

export type InstallSelectionState = "selected" | "skipped" | "required" | "unavailable";

export type InstallMode = "interactive" | "non-interactive";

export type InstallPresetId = "minimal" | "recommended" | "full";

export const installTargetCatalog = ["vscode", "cursor", "claude", "codex"] as const;

export type InstallTarget = (typeof installTargetCatalog)[number];

export type InstallationPreset = {
	id: InstallPresetId;
	label: string;
	description: string;
	recommended: boolean;
	defaultAreas: InstallAreaId[];
};

export type InstallationArea = {
	id: InstallAreaId;
	label: string;
	kind: InstallAreaKind;
	description: string;
	selectionState: InstallSelectionState;
	nonInteractiveSelectable: boolean;
};

export type InstallationPolicy = {
	presetId?: InstallPresetId;
	selectedAreas: InstallAreaId[];
	explicitAreaOverrides: InstallAreaId[];
	mode: InstallMode;
	ideTargets: InstallTarget[];
	selectedSkills: string[];
};

export const installAreaCatalog: readonly Omit<InstallationArea, "selectionState">[] = [
	{
		id: "core",
		label: "Core repository install",
		kind: "required",
		description:
			"Scaffold docs, initialize runtime state, generate reports, bootstrap Spec Kit, and verify readiness.",
		nonInteractiveSelectable: true,
	},
	{
		id: "ide",
		label: "IDE integration",
		kind: "optional",
		description: "Write a project-local MCP configuration file for an IDE or coding agent.",
		nonInteractiveSelectable: true,
	},
	{
		id: "skills",
		label: "Bundled skills",
		kind: "optional",
		description: "Install the bundled repository-local skill set under `.agents/skills/`.",
		nonInteractiveSelectable: true,
	},
] as const;

export const installPresetCatalog: readonly InstallationPreset[] = [
	{
		id: "minimal",
		label: "Minimal",
		description: "Install only the required core repository setup.",
		recommended: false,
		defaultAreas: ["core"],
	},
	{
		id: "recommended",
		label: "Recommended",
		description: "Install the core repository setup plus bundled repository skills.",
		recommended: true,
		defaultAreas: ["core", "skills"],
	},
	{
		id: "full",
		label: "Full",
		description: "Install the core repository setup, bundled skills, and IDE integration.",
		recommended: false,
		defaultAreas: ["core", "ide", "skills"],
	},
] as const;

const withRequiredCore = (areas: InstallAreaId[]): InstallAreaId[] => {
	const ordered: InstallAreaId[] = ["core"];
	for (const area of areas) {
		if (!ordered.includes(area)) {
			ordered.push(area);
		}
	}
	return ordered;
};

export const isInstallAreaId = (value: string): value is InstallAreaId =>
	installAreaCatalog.some((area) => area.id === value);

export const isInstallPresetId = (value: string): value is InstallPresetId =>
	installPresetCatalog.some((preset) => preset.id === value);

export const resolveInstallPreset = (presetId?: InstallPresetId): InstallationPreset => {
	const fallbackPreset =
		installPresetCatalog.find((preset) => preset.recommended) ?? installPresetCatalog[0];
	if (!fallbackPreset) {
		throw new Error("Install preset catalog is empty.");
	}
	return installPresetCatalog.find((preset) => preset.id === presetId) ?? fallbackPreset;
};

export const resolveInstallAreas = (
	presetId?: InstallPresetId,
	explicitAreas?: InstallAreaId[],
): InstallAreaId[] =>
	explicitAreas && explicitAreas.length > 0
		? withRequiredCore(explicitAreas)
		: withRequiredCore(resolveInstallPreset(presetId).defaultAreas);

export const createInstallationAreas = (selectedAreas: InstallAreaId[]): InstallationArea[] =>
	installAreaCatalog.map((area) => ({
		...area,
		selectionState:
			area.kind === "required"
				? "required"
				: selectedAreas.includes(area.id)
					? "selected"
					: "skipped",
	}));

export const createInstallationPolicy = (options: {
	presetId?: InstallPresetId;
	selectedAreas?: InstallAreaId[];
	explicitAreaOverrides?: InstallAreaId[];
	mode: InstallMode;
	ideTargets?: InstallTarget[];
	selectedSkills?: string[];
}): InstallationPolicy => {
	const explicitAreaOverrides = withRequiredCore(options.explicitAreaOverrides ?? []);
	const selectedAreas = withRequiredCore(
		options.selectedAreas?.length ? options.selectedAreas : resolveInstallAreas(options.presetId),
	);

	return {
		presetId: options.presetId,
		selectedAreas,
		explicitAreaOverrides,
		mode: options.mode,
		ideTargets: [...new Set(options.ideTargets ?? [])],
		selectedSkills: options.selectedSkills ?? [],
	};
};

export const validateInstallationPolicy = (
	policy: InstallationPolicy,
): { ok: boolean; errors: string[] } => {
	const errors: string[] = [];
	const selectedAreas = withRequiredCore(policy.selectedAreas);

	if (
		policy.mode === "non-interactive" &&
		!policy.presetId &&
		policy.explicitAreaOverrides.length === 0
	) {
		errors.push(
			"Non-interactive install requires an explicit preset or explicit install-area selections.",
		);
	}

	if (
		selectedAreas.includes("ide") &&
		policy.mode === "non-interactive" &&
		policy.ideTargets.length === 0
	) {
		errors.push(
			"Non-interactive install requires `--ide <target[,target]>` when IDE integration is selected.",
		);
	}

	return {
		ok: errors.length === 0,
		errors,
	};
};
