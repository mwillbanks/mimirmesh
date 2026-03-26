import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { findSkills, loadSkillRecords, readSkill } from "@mimirmesh/skills";

const createdRoots: string[] = [];

const createRepoSkill = async (
	projectRoot: string,
	index: number,
	description?: string,
): Promise<string> => {
	const name = `threshold-skill-${index.toString().padStart(2, "0")}`;
	const skillRoot = join(projectRoot, ".agents", "skills", name);
	await mkdir(join(skillRoot, "references"), { recursive: true });
	await mkdir(join(skillRoot, "templates"), { recursive: true });
	await writeFile(
		join(skillRoot, "SKILL.md"),
		`---
name: ${name}
description: ${
			description ??
			`This skill exists to prove deterministic discovery compression for registry validation scenario ${index}.`
		}
---

# ${name}

## When to Use
- Use for deterministic registry validation scenario ${index}

## Do First
- Confirm the selected repository workflow before reading broader context

## Decision Rules
- Read the memory projection before escalating to a targeted asset read

## Avoid
- Avoid loading unrelated templates or references
`,
		"utf8",
	);
	await writeFile(
		join(skillRoot, "references", "guide.md"),
		`# Guide\n\nReference body for ${name}.\n`,
		"utf8",
	);
	await writeFile(
		join(skillRoot, "templates", "snippet.md"),
		`Template body for ${name}.\n`,
		"utf8",
	);
	return name;
};

afterEach(async () => {
	await Promise.all(createdRoots.splice(0).map((root) => Bun.$`rm -rf ${root}`.quiet()));
});

describe("integration skills discovery thresholds", () => {
	test("keeps default discovery payload at least 70 percent smaller than full-fidelity aggregate skill payloads", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-skills-thresholds-"));
		createdRoots.push(projectRoot);

		const names: string[] = [];
		for (let index = 0; index < 25; index += 1) {
			names.push(await createRepoSkill(projectRoot, index));
		}

		const discovery = await findSkills(projectRoot, { names });
		const fullRecords = (await loadSkillRecords(projectRoot)).filter((record) =>
			names.includes(record.name),
		);
		const discoverySize = Buffer.byteLength(JSON.stringify(discovery), "utf8");
		const fullSize = Buffer.byteLength(JSON.stringify(fullRecords), "utf8");

		expect(discovery.total).toBe(25);
		expect(fullSize).toBeGreaterThan(discoverySize);
		expect(discoverySize / fullSize).toBeLessThanOrEqual(0.3);
	});

	test("supports one discovery plus one memory read for the next skill decision", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-skills-decision-"));
		createdRoots.push(projectRoot);
		const name = await createRepoSkill(
			projectRoot,
			0,
			"Use this skill to validate that a discovery response plus one memory read is enough to choose the next action.",
		);

		const discovery = await findSkills(projectRoot, { names: [name] });
		const selected = discovery.results[0]?.name;
		const memoryRead = await readSkill(projectRoot, {
			name: selected ?? name,
		});

		expect(discovery.results[0]?.cacheKey).toBeString();
		expect(memoryRead.mode).toBe("memory");
		expect(memoryRead.memory?.usageTriggers.length).toBeGreaterThan(0);
		expect(memoryRead.memory?.doFirst.length).toBeGreaterThan(0);
		expect(memoryRead.memory?.decisionRules.length).toBeGreaterThan(0);
		expect(memoryRead.indexes).toBeUndefined();
		expect(memoryRead.assets).toBeUndefined();
	});

	test("keeps targeted reads isolated to the explicitly selected asset bodies", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-skills-targeted-"));
		createdRoots.push(projectRoot);
		const name = await createRepoSkill(projectRoot, 0);

		const result = await readSkill(projectRoot, {
			name,
			mode: "assets",
			include: ["referencesIndex", "references"],
			select: {
				references: ["references/guide.md"],
			},
		});

		expect(result.assets?.references?.map((entry) => entry.path)).toEqual(["references/guide.md"]);
		expect(result.indexes?.references?.map((entry) => entry.path)).toEqual(["references/guide.md"]);
		expect(result.assets?.templates).toBeUndefined();
		expect(result.indexes?.templates).toBeUndefined();
	});
});
