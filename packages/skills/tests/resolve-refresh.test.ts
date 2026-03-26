import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { refreshSkills, resolveSkills } from "../src";

const createdRoots: string[] = [];

const createSkill = async (
	projectRoot: string,
	options: {
		name: string;
		description: string;
		aliases?: string[];
		triggers?: string[];
	},
): Promise<void> => {
	const skillRoot = join(projectRoot, ".agents", "skills", options.name);
	await mkdir(skillRoot, { recursive: true });
	await writeFile(
		join(skillRoot, "SKILL.md"),
		`---
name: ${options.name}
description: ${options.description}
metadata:
  aliases: ${JSON.stringify(options.aliases ?? [])}
  triggers: ${JSON.stringify(options.triggers ?? [])}
---

# ${options.name}

## Steps
- Handle ${options.description}
`,
		"utf8",
	);
};

afterEach(async () => {
	await Promise.all(createdRoots.splice(0).map((root) => Bun.$`rm -rf ${root}`.quiet()));
});

describe("skill resolve and refresh", () => {
	test("applies deterministic precedence with always-load and prompt matches", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-skills-resolve-"));
		createdRoots.push(projectRoot);
		await createSkill(projectRoot, {
			name: "repo-always-load",
			description: "Always include this skill",
		});
		await createSkill(projectRoot, {
			name: "repo-install-helper",
			description: "Update the skill install workflow",
			aliases: ["install-helper"],
		});

		const result = await resolveSkills(
			projectRoot,
			{
				prompt: "update the skill install workflow with install-helper",
				include: ["matchReason", "score", "configInfluence"],
			},
			{
				alwaysLoad: ["repo-always-load"],
			},
		);

		expect(result.results[0]?.name).toBe("repo-always-load");
		expect(result.results.some((entry) => entry.name === "repo-install-helper")).toBe(true);
		expect(result.precedenceApplied[0]).toBe("alwaysLoad");
	});

	test("refresh returns the selected skill set", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-skills-refresh-"));
		createdRoots.push(projectRoot);
		await createSkill(projectRoot, {
			name: "repo-refresh-skill",
			description: "Refresh this skill",
		});

		const result = await refreshSkills(projectRoot, {
			names: ["repo-refresh-skill"],
		});

		expect(result.map((entry) => entry.name)).toEqual(["repo-refresh-skill"]);
	});

	test("uses injected embedding matches during the embeddings precedence stage", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-skills-embedding-stage-"));
		createdRoots.push(projectRoot);
		await createSkill(projectRoot, {
			name: "repo-embedding-skill",
			description: "Vector-ranked skill",
		});

		const result = await resolveSkills(
			projectRoot,
			{
				prompt: "opaque semantic intent",
				include: ["matchReason", "score"],
			},
			{
				resolve: {
					precedence: ["embeddings"],
				},
			},
			undefined,
			{
				embeddingMatches: [
					{
						name: "repo-embedding-skill",
						score: 0.97,
						reason: "embeddings",
					},
				],
			},
		);

		expect(result.results[0]?.name).toBe("repo-embedding-skill");
		expect(result.results[0]?.matchReason).toBe("embeddings");
		expect(result.results[0]?.score).toBeGreaterThan(300);
	});
});
