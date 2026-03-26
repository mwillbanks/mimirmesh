import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultConfig } from "@mimirmesh/config";
import { loadSkillRegistrySnapshot, refreshSkillRegistryStore } from "@mimirmesh/runtime";
import {
	createSkillPackage,
	ensureManagedAgentsSection,
	findSkills,
	readSkill,
	resolveSkills,
	updateSkillPackage,
} from "@mimirmesh/skills";

import { startSkillRegistryRuntime } from "../_helpers/skills-runtime";

const createdRoots: string[] = [];

const createRepoSkill = async (
	projectRoot: string,
	name: string,
	description: string,
): Promise<void> => {
	const skillRoot = join(projectRoot, ".agents", "skills", name);
	await mkdir(join(skillRoot, "references"), { recursive: true });
	await writeFile(
		join(skillRoot, "SKILL.md"),
		`---
name: ${name}
description: ${description}
metadata:
  aliases:
    - ${name}-alias
---

# ${name}

## When to Use
- Use for ${description}

## Do First
- Read the memory projection
`,
		"utf8",
	);
	await writeFile(
		join(skillRoot, "references", "guide.md"),
		`# Guide\n\nReference body for ${name}\n`,
		"utf8",
	);
};

afterEach(async () => {
	await Promise.all(
		createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe("integration skills end to end", () => {
	test("covers managed guidance, discovery, reading, runtime refresh, resolve, and authoring in one repository flow", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-skills-e2e-"));
		createdRoots.push(projectRoot);
		await createRepoSkill(projectRoot, "e2e-navigation-skill", "Code navigation");
		await createRepoSkill(projectRoot, "e2e-install-skill", "Install workflow guidance");

		const guidance = await ensureManagedAgentsSection(projectRoot);
		const discovery = await findSkills(projectRoot, { query: "navigation", limit: 5 });
		const read = await readSkill(projectRoot, { name: "e2e-navigation-skill" });
		const resolved = await resolveSkills(projectRoot, {
			prompt: "refine the install workflow with e2e-install-skill",
			include: ["matchReason"],
		});
		const created = await createSkillPackage(projectRoot, {
			prompt: "Create an integration registry skill",
			mode: "write",
			validateBeforeWrite: true,
		});
		const updated = await updateSkillPackage(projectRoot, {
			name: created.generatedSkillName ?? "",
			prompt: "Add end-to-end validation notes",
			mode: "write",
			validateAfterWrite: true,
		});

		expect(["created", "updated", "no-op"]).toContain(guidance.outcome);
		expect(await readFile(join(projectRoot, "AGENTS.md"), "utf8")).toContain(
			"BEGIN MIMIRMESH SKILLS SECTION",
		);
		expect(discovery.results.map((entry) => entry.name)).toContain("e2e-navigation-skill");
		expect(read.mode).toBe("memory");
		expect(resolved.results.map((entry) => entry.name)).toContain("e2e-install-skill");
		expect(created.writeResult?.status).toBe("written");
		expect(updated.writeResult?.status).toBe("written");

		const config = createDefaultConfig(projectRoot);
		const runtime = await startSkillRegistryRuntime(projectRoot, config);
		if (!runtime.available) {
			return;
		}

		try {
			const refreshed = await refreshSkillRegistryStore(projectRoot, config);
			const snapshot = await loadSkillRegistrySnapshot(projectRoot, config);

			expect(refreshed.response.refreshedSkills).toContain("e2e-navigation-skill");
			expect(snapshot.skills.map((entry) => entry.name)).toContain("e2e-install-skill");
			expect(
				snapshot.positiveCache.some((entry) => entry.skillName === "e2e-navigation-skill"),
			).toBe(true);
		} finally {
			await runtime.stop();
		}
	}, 30_000);
});
