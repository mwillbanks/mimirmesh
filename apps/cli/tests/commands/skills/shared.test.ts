import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { bundledSkillsInstallDir, installBundledSkills } from "@mimirmesh/skills";
import { loadSkillSelectionModel } from "../../../src/commands/skills/shared";

const withProjectRoot = async <T>(projectRoot: string, run: () => Promise<T>): Promise<T> => {
	const originalProjectRoot = process.env.MIMIRMESH_PROJECT_ROOT;
	process.env.MIMIRMESH_PROJECT_ROOT = projectRoot;

	try {
		return await run();
	} finally {
		if (originalProjectRoot === undefined) {
			delete process.env.MIMIRMESH_PROJECT_ROOT;
		} else {
			process.env.MIMIRMESH_PROJECT_ROOT = originalProjectRoot;
		}
	}
};

describe("skills selection model", () => {
	test("install defaults all bundled skills to selected", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-skills-install-model-"));

		const model = await withProjectRoot(projectRoot, async () =>
			loadSkillSelectionModel("install"),
		);

		expect(model.choices.length).toBeGreaterThan(0);
		expect(model.defaultValues).toEqual(model.choices.map((choice) => choice.value));
	});

	test("update only shows installed outdated bundled skills and preselects them", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-skills-update-model-"));

		await installBundledSkills({
			projectRoot,
			names: ["mimirmesh-code-navigation"],
			mode: "copy",
		});
		await writeFile(
			join(bundledSkillsInstallDir(projectRoot), "mimirmesh-code-navigation", "SKILL.md"),
			"drifted\n",
			"utf8",
		);

		const model = await withProjectRoot(projectRoot, async () => loadSkillSelectionModel("update"));

		expect(model.choices.map((choice) => choice.value)).toEqual(["mimirmesh-code-navigation"]);
		expect(model.defaultValues).toEqual(["mimirmesh-code-navigation"]);
	});

	test("remove only shows installed skills and does not preselect any", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-skills-remove-model-"));

		await installBundledSkills({
			projectRoot,
			names: ["mimirmesh-agent-router"],
			mode: "symlink",
		});

		const model = await withProjectRoot(projectRoot, async () => loadSkillSelectionModel("remove"));

		expect(model.choices.map((choice) => choice.value)).toEqual(["mimirmesh-agent-router"]);
		expect(model.defaultValues).toEqual([]);
	});
});
