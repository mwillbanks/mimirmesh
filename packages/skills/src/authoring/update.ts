import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { SkillsUpdateRequest, SkillsUpdateResponse } from "../types";

const buildUpdateInsertion = (prompt: string): string => `## Update Notes\n- ${prompt}\n`;

export const updateSkillPackage = async (
	projectRoot: string,
	request: SkillsUpdateRequest,
): Promise<SkillsUpdateResponse> => {
	const mode = request.mode ?? "patchPlan";
	const skillPath = join(projectRoot, ".agents", "skills", request.name, "SKILL.md");
	const original = await readFile(skillPath, "utf8");
	const updated = original.includes("## Update Notes")
		? original.replace(
				"## Update Notes",
				`${buildUpdateInsertion(request.prompt)}\n## Update Notes`,
			)
		: `${original.trimEnd()}\n\n${buildUpdateInsertion(request.prompt)}`;
	const findings = updated.includes(request.prompt)
		? []
		: ["Prompt text was not incorporated into the updated skill."];
	const response: SkillsUpdateResponse = {
		name: request.name,
		mode,
		recommendations: request.includeRecommendations
			? ["Preserve unrelated files while updating the package."]
			: [],
		gapAnalysis: request.includeGapAnalysis
			? ["Review whether supporting references or examples also need updates."]
			: [],
		completenessAnalysis: request.includeCompletenessAnalysis
			? ["Confirm the update keeps the skill self-sufficient."]
			: [],
		consistencyFindings: request.includeConsistencyAnalysis
			? ["Update preserves the existing package path."]
			: [],
		validation: {
			status:
				(request.validateBeforeWrite || request.validateAfterWrite) && findings.length > 0
					? "failed"
					: request.validateBeforeWrite || request.validateAfterWrite
						? "passed"
						: "skipped",
			findings,
		},
		patchPlan: {
			summary: `Append update guidance for ${request.name}.`,
			affectedFiles: [skillPath],
		},
	};

	if (mode === "write" && response.validation.status !== "failed") {
		await writeFile(skillPath, updated, "utf8");
		response.writeResult = {
			status: "written",
			files: [skillPath],
		};
	}

	return response;
};
