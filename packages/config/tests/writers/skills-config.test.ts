import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readConfig } from "../../src";
import { createDefaultConfig } from "../../src/defaults";
import { writeSkillsConfig } from "../../src/writers";

describe("skills config writer", () => {
	test("writes a validated skills policy block into the repository config", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-skills-writer-"));
		const config = createDefaultConfig(repo);
		const nextSkills = {
			...config.skills,
			alwaysLoad: ["mimirmesh-agent-router"],
			embeddings: {
				enabled: true,
				fallbackOnFailure: true,
				providers: [
					{
						type: "llama_cpp" as const,
						model: "Qwen/Qwen3-Embedding-0.6B-GGUF",
						baseUrl: "http://localhost:8012/v1",
						timeoutMs: 30_000,
						maxRetries: 2,
					},
				],
			},
		};

		try {
			await writeSkillsConfig(repo, config, nextSkills);

			const loaded = await readConfig(repo, { createIfMissing: false });
			expect(loaded.skills.alwaysLoad).toEqual(["mimirmesh-agent-router"]);
			expect(loaded.skills.embeddings.enabled).toBe(true);

			const raw = await readFile(join(repo, ".mimirmesh", "config.yml"), "utf8");
			expect(raw).toContain("mimirmesh-agent-router");
			expect(raw).toContain("Qwen/Qwen3-Embedding-0.6B-GGUF");
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});
});
