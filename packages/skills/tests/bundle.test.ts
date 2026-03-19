import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	bundledSkillNames,
	createBundledSkillCatalog,
	getSkillsPackageRoot,
	validateBundledSkills,
	writeBundledSkillAssets,
} from "../src";

describe("bundled skills", () => {
	test("contains the authoritative primary and supporting skill set", async () => {
		const catalog = await createBundledSkillCatalog();
		expect(catalog.map((skill) => skill.name)).toEqual([...bundledSkillNames]);
	});

	test("passes the local Agent Skills validation checks", async () => {
		const issues = await validateBundledSkills();
		expect(issues).toEqual([]);
	});

	test("writes an installable bundle catalog alongside the packaged skills", async () => {
		const root = await mkdtemp(join(tmpdir(), "mimirmesh-skills-"));
		const target = join(root, "skills");

		await writeBundledSkillAssets(target);

		const rawCatalog = await readFile(join(target, "catalog.json"), "utf8");
		const catalog = JSON.parse(rawCatalog) as {
			skills: Array<{ name: string; path: string }>;
		};

		expect(catalog.skills.map((skill) => skill.name)).toEqual([...bundledSkillNames]);
		expect(catalog.skills.every((skill) => skill.path === skill.name)).toBe(true);
		expect(getSkillsPackageRoot()).toContain("/packages/skills");
	});
});
