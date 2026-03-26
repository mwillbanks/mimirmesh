import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultConfig } from "@mimirmesh/config";
import { z } from "zod";
import { startSkillRegistryRuntime } from "../../../../tests/_helpers/skills-runtime";
import { createToolRouter } from "../../src/registry/router";
import { skillsToolInputSchemas } from "../../src/registry/skills-tools";

const createdRoots: string[] = [];

const createRepoSkill = async (
	projectRoot: string,
	name: string,
	description: string,
): Promise<void> => {
	const skillRoot = join(projectRoot, ".agents", "skills", name);
	await mkdir(skillRoot, { recursive: true });
	await writeFile(
		join(skillRoot, "SKILL.md"),
		`---
name: ${name}
description: ${description}
---

# ${name}

## Steps
- Use for ${description}
`,
		"utf8",
	);
};

afterEach(async () => {
	await Promise.all(createdRoots.splice(0).map((root) => Bun.$`rm -rf ${root}`.quiet()));
});

describe("skills unified tools", () => {
	test("keeps the documented skill request shapes constrained", () => {
		const findSchema = z.object(skillsToolInputSchemas["skills.find"]);
		const readSchema = z.object(skillsToolInputSchemas["skills.read"]);
		const readSelectSchema = skillsToolInputSchemas["skills.read"].select.unwrap();

		expect(
			findSchema.safeParse({
				query: "repo skill",
				names: ["router-find-skill"],
				include: ["summary", "matchReason"],
				limit: 5,
				offset: 0,
			}).success,
		).toBe(true);
		expect(findSchema.safeParse({ include: ["not-allowed"] }).success).toBe(false);

		expect(Object.keys(readSelectSchema.shape).sort()).toEqual([
			"auxiliary",
			"examples",
			"references",
			"scripts",
			"sections",
			"templates",
		]);
		expect(
			readSchema.safeParse({
				name: "router-find-skill",
				mode: "memory",
				include: ["metadata", "referencesIndex"],
				select: {
					sections: ["When to Use"],
					references: ["references/guide.md"],
				},
			}).success,
		).toBe(true);
		expect(
			readSchema.safeParse({ name: "router-find-skill", mode: "invalid" as never }).success,
		).toBe(false);
	});

	test("supports find and read through the router", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-mcp-skills-"));
		createdRoots.push(projectRoot);
		await createRepoSkill(projectRoot, "router-find-skill", "Router skill");
		const config = createDefaultConfig(projectRoot);
		const runtime = await startSkillRegistryRuntime(projectRoot, config);
		if (!runtime.available) {
			return;
		}
		const router = createToolRouter({
			projectRoot,
			config,
		});
		await router.callTool("skills.refresh", {});

		try {
			const findResult = await router.callTool("skills.find", {
				names: ["router-find-skill"],
			});
			const readResult = await router.callTool("skills.read", {
				name: "router-find-skill",
			});

			expect(findResult.success).toBe(true);
			expect(findResult.raw).toMatchObject({
				total: 1,
			});
			expect(findResult.items[0]?.metadata).toEqual({});
			expect(readResult.success).toBe(true);
			expect(readResult.raw).toMatchObject({
				name: "router-find-skill",
				mode: "memory",
			});
			expect(readResult.items[0]?.metadata).toEqual({});
			expect(readResult.items[0]?.content.startsWith("{")).toBe(false);
		} finally {
			await runtime.stop();
		}
	});

	test("supports resolve and authoring through the router", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-mcp-skills-authoring-"));
		createdRoots.push(projectRoot);
		await createRepoSkill(projectRoot, "router-update-skill", "Update workflows");
		const config = createDefaultConfig(projectRoot);
		const runtime = await startSkillRegistryRuntime(projectRoot, config);
		if (!runtime.available) {
			return;
		}
		const router = createToolRouter({
			projectRoot,
			config,
		});
		await router.callTool("skills.refresh", {});

		try {
			const resolveResult = await router.callTool("skills.resolve", {
				prompt: "update router-update-skill",
				include: ["matchReason"],
			});
			const updateResult = await router.callTool("skills.update", {
				name: "router-update-skill",
				prompt: "Add update guidance",
				mode: "write",
			});

			expect(resolveResult.success).toBe(true);
			expect((resolveResult.raw as { total: number }).total).toBeGreaterThanOrEqual(1);
			expect(updateResult.success).toBe(true);
		} finally {
			await runtime.stop();
		}
	});

	test("uses persisted registry state until skills.refresh mutates it", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-mcp-skills-persisted-"));
		createdRoots.push(projectRoot);
		await createRepoSkill(projectRoot, "router-persisted-skill", "Persisted registry");
		const config = createDefaultConfig(projectRoot);
		const runtime = await startSkillRegistryRuntime(projectRoot, config);
		if (!runtime.available) {
			return;
		}
		const router = createToolRouter({
			projectRoot,
			config,
		});
		await router.callTool("skills.refresh", {});

		try {
			const initialFind = await router.callTool("skills.find", {
				names: ["router-persisted-skill"],
			});
			await rm(join(projectRoot, ".agents", "skills", "router-persisted-skill"), {
				recursive: true,
				force: true,
			});

			const cachedFind = await router.callTool("skills.find", {
				names: ["router-persisted-skill"],
			});
			const refreshResult = await router.callTool("skills.refresh", {
				names: ["router-persisted-skill"],
			});
			const afterRefresh = await router.callTool("skills.find", {
				names: ["router-persisted-skill"],
			});

			expect((initialFind.raw as { total: number }).total).toBe(1);
			expect((cachedFind.raw as { total: number }).total).toBe(1);
			expect(
				(refreshResult.raw as { invalidatedPositiveCacheEntries: number })
					.invalidatedPositiveCacheEntries,
			).toBeGreaterThanOrEqual(1);
			expect((afterRefresh.raw as { total: number }).total).toBe(0);
		} finally {
			await runtime.stop();
		}
	});
});
