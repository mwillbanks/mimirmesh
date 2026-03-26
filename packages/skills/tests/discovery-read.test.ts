import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { compressText, decompressText, findSkills, readSkill } from "../src";

const createdRoots: string[] = [];

const createRepoSkill = async (name: string, description: string): Promise<string> => {
	const root = await mkdtemp(join(tmpdir(), "mimirmesh-skills-discovery-"));
	createdRoots.push(root);
	const skillRoot = join(root, ".agents", "skills", name);
	await mkdir(join(skillRoot, "references"), { recursive: true });
	await mkdir(join(skillRoot, "templates"), { recursive: true });
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
- Use for ${name}

## Avoid
- Avoid unrelated tasks
`,
		"utf8",
	);
	await writeFile(join(skillRoot, "references", "guide.md"), "# guide\n", "utf8");
	await writeFile(join(skillRoot, "templates", "snippet.md"), "snippet\n", "utf8");
	return root;
};

afterEach(async () => {
	await Promise.all(createdRoots.splice(0).map((root) => Bun.$`rm -rf ${root}`.quiet()));
});

describe("skill discovery and read", () => {
	test("returns the minimal descriptor shape by default", async () => {
		const projectRoot = await createRepoSkill(
			"repo-discovery-skill",
			"This is a deliberately verbose description that should be truncated for default descriptor discovery and remain deterministic across repeated calls to the same skill.",
		);

		const result = await findSkills(projectRoot, { names: ["repo-discovery-skill"] });

		expect(result.total).toBe(1);
		expect(result.results[0]?.name).toBe("repo-discovery-skill");
		expect(result.results[0]?.shortDescription).toBe(
			"This is a deliberately verbose description that should be truncated for default descriptor discovery and remain deterministic across repeated calls to the same…",
		);
		expect(result.results[0]?.cacheKey).toBeString();
	});

	test("supports targeted reads without unrelated asset bodies", async () => {
		const projectRoot = await createRepoSkill("repo-read-skill", "Read target");

		const result = await readSkill(projectRoot, {
			name: "repo-read-skill",
			mode: "assets",
			include: ["referencesIndex", "references"],
			select: {
				references: ["references/guide.md"],
			},
		});

		expect(result.mode).toBe("assets");
		expect(result.indexes?.references?.map((entry) => entry.path)).toEqual(["references/guide.md"]);
		expect(result.assets?.references?.map((entry) => entry.path)).toEqual(["references/guide.md"]);
		expect(result.assets?.templates).toBeUndefined();
		expect(result.readSignature.length).toBeGreaterThan(10);
	});

	test("uses zstd for default memory reads when Bun exposes sync zstd support", async () => {
		const projectRoot = await createRepoSkill("repo-memory-skill", "Memory target");

		const result = await readSkill(projectRoot, {
			name: "repo-memory-skill",
		});

		expect(result.mode).toBe("memory");
		expect(result.compression.algorithm).toBe("zstd");
		expect(result.memory?.referencesIndex).toBeUndefined();
		expect(result.memory?.scriptsIndex).toBeUndefined();
		expect(result.memory?.templatesIndex).toBeUndefined();
		expect(result.memory?.examplesIndex).toBeUndefined();
	});

	test("round-trips memory payloads through zstd compression when supported", () => {
		const bunCompression = Bun as unknown as {
			zstdCompressSync?: (value: Uint8Array | string) => Uint8Array;
			zstdDecompressSync?: (value: Uint8Array) => Uint8Array;
		};
		if (
			typeof bunCompression.zstdCompressSync !== "function" ||
			typeof bunCompression.zstdDecompressSync !== "function"
		) {
			return;
		}

		const payload = JSON.stringify({
			name: "repo-memory-skill",
			description: "Memory target",
		});

		const compressed = compressText(payload);

		expect(compressed.algorithm).toBe("zstd");
		expect(decompressText({ algorithm: compressed.algorithm, data: compressed.data })).toBe(
			payload,
		);
	});
});
