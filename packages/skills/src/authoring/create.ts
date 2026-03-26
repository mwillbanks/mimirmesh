import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { SkillsCreateRequest, SkillsCreateResponse } from "../types";
import { renderSkillTemplate } from "./templates";

const slugify = (value: string): string =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64) || "new-skill";

const deriveName = (request: SkillsCreateRequest): string => {
	if (request.targetPath) {
		return basename(request.targetPath);
	}
	return slugify(request.prompt.split(/\s+/).slice(0, 4).join("-"));
};

const buildAnalyses = (request: SkillsCreateRequest, name: string) => ({
	recommendations: request.includeRecommendations
		? [
				"Keep the description concrete and task-specific.",
				"Add references or scripts only when the workflow truly needs them.",
			]
		: [],
	gapAnalysis: request.includeGapAnalysis
		? [
				"Confirm the skill includes execution guidance rather than only policy text.",
				"Confirm the skill name matches the target directory.",
			]
		: [],
	completenessAnalysis: request.includeCompletenessAnalysis
		? [
				"Frontmatter includes name and description.",
				"Body includes purpose, inputs, outputs, and steps.",
			]
		: [],
	consistencyFindings: request.includeConsistencyAnalysis
		? [`Generated skill package is aligned to ${name}.`]
		: [],
});

export const createSkillPackage = async (
	projectRoot: string,
	request: SkillsCreateRequest,
): Promise<SkillsCreateResponse> => {
	const mode = request.mode ?? "generate";
	const generatedSkillName = deriveName(request);
	const targetPath =
		request.targetPath ?? join(projectRoot, ".agents", "skills", generatedSkillName);
	const generatedSkill = renderSkillTemplate({
		name: generatedSkillName,
		description: request.prompt,
		prompt: request.prompt,
		template: request.template,
	});
	const analyses = buildAnalyses(request, generatedSkillName);
	const validationFindings = generatedSkill.includes("## Purpose")
		? []
		: ["Generated skill is missing a Purpose section."];
	const response: SkillsCreateResponse = {
		mode,
		targetPath,
		generatedSkillName,
		recommendations: analyses.recommendations,
		gapAnalysis: analyses.gapAnalysis,
		completenessAnalysis: analyses.completenessAnalysis,
		consistencyFindings: analyses.consistencyFindings,
		validation: {
			status:
				request.validateBeforeWrite && validationFindings.length > 0
					? "failed"
					: request.validateBeforeWrite
						? "passed"
						: "skipped",
			findings: validationFindings,
		},
		generatedFiles: {
			"SKILL.md": generatedSkill,
		},
	};

	if (mode === "write" && response.validation.status !== "failed") {
		await mkdir(targetPath, { recursive: true });
		await writeFile(join(targetPath, "SKILL.md"), generatedSkill, "utf8");
		response.writeResult = {
			status: "written",
			files: [join(targetPath, "SKILL.md")],
		};
	} else if (mode === "write") {
		response.writeResult = {
			status: "skipped",
			files: [],
		};
	}

	return response;
};
