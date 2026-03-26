import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { MimirmeshConfig } from "@mimirmesh/config";

export type TemplateFamily =
	| "architecture"
	| "feature"
	| "runbook"
	| "operationalNote"
	| "decisionNote"
	| "agentGuidance";

export type GenerateDocumentInput = {
	family: TemplateFamily;
	title: string;
	context: Record<string, string | number | boolean | null | undefined>;
	targetPath?: string;
};

const builtinTemplates: Record<TemplateFamily, string> = {
	architecture: `# {{title}}

## Scope
- {{scope}}

## Components
- {{components}}

## Data Flow
{{dataFlow}}

## Risks
{{risks}}
`,
	feature: `# {{title}}

## Problem
{{problem}}

## Behavior
{{behavior}}

## Acceptance Criteria
{{acceptanceCriteria}}
`,
	runbook: `# {{title}}

## Trigger
{{trigger}}

## Preconditions
{{preconditions}}

## Steps
{{steps}}

## Verification
{{verification}}
`,
	operationalNote: `# {{title}}

## Date
{{date}}

## Summary
{{summary}}

## Action Items
{{actions}}
`,
	decisionNote: `# {{title}}

## Context
{{context}}

## Decision
{{decision}}

## Consequences
{{consequences}}
`,
	agentGuidance: `# {{title}}

## Repository Expectations
{{expectations}}

## Preferred Workflow
{{workflow}}

## Safety Notes
{{safety}}
`,
};

const recommendedDirectories: Record<TemplateFamily, string> = {
	architecture: "docs/architecture",
	feature: "docs/features",
	runbook: "docs/runbooks",
	operationalNote: "docs/operations",
	decisionNote: "docs/adr",
	agentGuidance: ".",
};

const isSlugCharacter = (character: string): boolean => {
	const code = character.charCodeAt(0);
	return (code >= 97 && code <= 122) || (code >= 48 && code <= 57);
};

const slugify = (value: string): string => {
	const normalized = value.toLowerCase().trim();
	const characters: string[] = [];
	let pendingSeparator = false;

	for (const character of normalized) {
		if (isSlugCharacter(character)) {
			if (pendingSeparator && characters.length > 0) {
				characters.push("-");
			}
			characters.push(character);
			pendingSeparator = false;
			continue;
		}

		pendingSeparator = characters.length > 0;
	}

	return characters.join("") || "document";
};

const renderTemplate = (
	template: string,
	input: Record<string, string | number | boolean | null | undefined>,
): string => {
	const defaults = {
		title: "Mimirmesh Generated Document",
		date: new Date().toISOString().slice(0, 10),
	};
	const context = {
		...defaults,
		...input,
	};

	return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
		const value = context[key as keyof typeof context];
		if (value === null || value === undefined) {
			return "";
		}
		return String(value);
	});
};

const fileExists = async (path: string): Promise<boolean> => {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
};

const resolveOverridePath = (
	_projectRoot: string,
	config: MimirmeshConfig,
	family: TemplateFamily,
): string => join(config.templates.overrideDir, config.templates.families[family]);

const loadTemplate = async (
	projectRoot: string,
	config: MimirmeshConfig,
	family: TemplateFamily,
): Promise<string> => {
	const overridePath = resolveOverridePath(projectRoot, config, family);
	if (await fileExists(overridePath)) {
		return readFile(overridePath, "utf8");
	}
	return builtinTemplates[family];
};

const ensureUniquePath = async (path: string): Promise<string> => {
	if (!(await fileExists(path))) {
		return path;
	}
	const extensionIndex = path.lastIndexOf(".");
	const stem = extensionIndex >= 0 ? path.slice(0, extensionIndex) : path;
	const extension = extensionIndex >= 0 ? path.slice(extensionIndex) : "";
	for (let i = 1; i <= 999; i += 1) {
		const candidate = `${stem}-${i}${extension}`;
		if (!(await fileExists(candidate))) {
			return candidate;
		}
	}
	throw new Error(`Unable to allocate unique file name for ${path}`);
};

export const recommendedDocumentPath = (
	projectRoot: string,
	family: TemplateFamily,
	title: string,
): string => {
	const directory = recommendedDirectories[family];
	if (family === "agentGuidance") {
		return join(projectRoot, "AGENTS.md");
	}
	return join(projectRoot, directory, `${slugify(title)}.md`);
};

export const generateDocument = async (
	projectRoot: string,
	config: MimirmeshConfig,
	input: GenerateDocumentInput,
): Promise<{ path: string; created: boolean }> => {
	const template = await loadTemplate(projectRoot, config, input.family);
	const rendered = renderTemplate(template, {
		title: input.title,
		...input.context,
	});

	const preferredPath =
		input.targetPath ?? recommendedDocumentPath(projectRoot, input.family, input.title);
	const outputPath =
		input.family === "agentGuidance" ? preferredPath : await ensureUniquePath(preferredPath);
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, rendered.endsWith("\n") ? rendered : `${rendered}\n`, "utf8");
	return {
		path: outputPath,
		created: true,
	};
};

export const listTemplateFamilies = (): TemplateFamily[] => [
	"architecture",
	"feature",
	"runbook",
	"operationalNote",
	"decisionNote",
	"agentGuidance",
];

export const templatePreview = async (
	projectRoot: string,
	config: MimirmeshConfig,
	family: TemplateFamily,
): Promise<string> => loadTemplate(projectRoot, config, family);
