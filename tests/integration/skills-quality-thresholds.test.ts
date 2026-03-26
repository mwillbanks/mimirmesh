import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultConfig } from "@mimirmesh/config";
import { loadSkillRegistrySnapshot, refreshSkillRegistryStore } from "@mimirmesh/runtime";
import {
	createSkillPackage,
	refreshSkills,
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
	await mkdir(skillRoot, { recursive: true });
	await writeFile(
		join(skillRoot, "SKILL.md"),
		`---
name: ${name}
description: ${description}
---

# ${name}

## When to Use
- Use for ${description}
`,
		"utf8",
	);
};

afterEach(async () => {
	await Promise.all(
		createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe("integration skills quality thresholds", () => {
	test("keeps resolve and refresh deterministic when embeddings are disabled", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-skills-embeddings-off-"));
		createdRoots.push(projectRoot);
		await createRepoSkill(projectRoot, "embeddings-off-router", "Deterministic router");
		await createRepoSkill(projectRoot, "embeddings-off-build", "Deterministic build helper");

		const policy = {
			embeddings: {
				enabled: false,
				fallbackOnFailure: true,
				providers: [],
			},
		};
		const first = await resolveSkills(projectRoot, { prompt: "deterministic router" }, policy);
		const second = await resolveSkills(projectRoot, { prompt: "deterministic router" }, policy);
		const refreshed = await refreshSkills(projectRoot, {});

		expect(first.results.map((entry) => entry.name)).toEqual(
			second.results.map((entry) => entry.name),
		);
		expect(refreshed.map((entry) => entry.name)).toContain("embeddings-off-router");
	});

	test("completes create and update authoring writes without manual repair", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-skills-authoring-threshold-"));
		createdRoots.push(projectRoot);

		const created = await createSkillPackage(projectRoot, {
			prompt: "Create a threshold validation skill for integration testing",
			mode: "write",
			includeRecommendations: true,
			includeGapAnalysis: true,
			includeCompletenessAnalysis: true,
			includeConsistencyAnalysis: true,
			validateBeforeWrite: true,
		});
		const updated = await updateSkillPackage(projectRoot, {
			name: created.generatedSkillName ?? "",
			prompt: "Append integration hardening guidance",
			mode: "write",
			includeRecommendations: true,
			includeGapAnalysis: true,
			includeCompletenessAnalysis: true,
			includeConsistencyAnalysis: true,
			validateAfterWrite: true,
		});

		expect(created.writeResult?.status).toBe("written");
		expect(updated.writeResult?.status).toBe("written");
		expect(await readFile(join(created.targetPath ?? "", "SKILL.md"), "utf8")).toContain(
			"Append integration hardening guidance",
		);
	});

	test("invalidates stale positive and negative cache assumptions within five seconds under local runtime conditions", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-skills-refresh-threshold-"));
		createdRoots.push(projectRoot);
		await createRepoSkill(projectRoot, "threshold-refresh-skill", "Original threshold description");
		const config = createDefaultConfig(projectRoot);
		const runtime = await startSkillRegistryRuntime(projectRoot, config);
		if (!runtime.available) {
			return;
		}

		try {
			await refreshSkillRegistryStore(projectRoot, config);
			await refreshSkillRegistryStore(projectRoot, config, {
				names: ["threshold-missing-skill"],
			});
			await createRepoSkill(
				projectRoot,
				"threshold-refresh-skill",
				"Updated threshold description",
			);

			const startedAt = Date.now();
			const refreshed = await refreshSkillRegistryStore(projectRoot, config, {
				names: ["threshold-refresh-skill", "threshold-missing-skill"],
			});
			const elapsedMs = Date.now() - startedAt;
			const snapshot = await loadSkillRegistrySnapshot(projectRoot, config);

			expect(elapsedMs).toBeLessThan(5_000);
			expect(refreshed.response.invalidatedPositiveCacheEntries).toBeGreaterThanOrEqual(1);
			expect(refreshed.response.invalidatedNegativeCacheEntries).toBeGreaterThanOrEqual(1);
			expect(snapshot.skills.map((entry) => entry.name)).toContain("threshold-refresh-skill");
		} finally {
			await runtime.stop();
		}
	}, 30_000);
});
