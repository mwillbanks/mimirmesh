import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createSkillPackage, updateSkillPackage } from "../src";

const createdRoots: string[] = [];

afterEach(async () => {
	await Promise.all(createdRoots.splice(0).map((root) => Bun.$`rm -rf ${root}`.quiet()));
});

describe("skill authoring", () => {
	test("creates a skill package in write mode", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-skills-create-"));
		createdRoots.push(projectRoot);

		const result = await createSkillPackage(projectRoot, {
			prompt: "Create a repository-local authoring skill",
			mode: "write",
			includeRecommendations: true,
			includeGapAnalysis: true,
			includeCompletenessAnalysis: true,
			validateBeforeWrite: true,
		});

		expect(result.writeResult?.status).toBe("written");
		expect(result.generatedSkillName).toContain("create-a-repository");
		expect(await readFile(join(result.targetPath ?? "", "SKILL.md"), "utf8")).toContain(
			"## Purpose",
		);
	});

	test("updates an existing skill package in write mode", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-skills-update-authoring-"));
		createdRoots.push(projectRoot);
		const skillRoot = join(projectRoot, ".agents", "skills", "repo-authoring-skill");
		await mkdir(skillRoot, { recursive: true });
		await writeFile(
			join(skillRoot, "SKILL.md"),
			`---
name: repo-authoring-skill
description: Existing skill
---

# Existing skill
`,
			"utf8",
		);

		const result = await updateSkillPackage(projectRoot, {
			name: "repo-authoring-skill",
			prompt: "Add authoring update guidance",
			mode: "write",
			validateAfterWrite: true,
		});

		expect(result.writeResult?.status).toBe("written");
		expect(await readFile(join(skillRoot, "SKILL.md"), "utf8")).toContain(
			"Add authoring update guidance",
		);
	});
});
