import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parse, stringify } from "yaml";

import { createDefaultConfig, readConfig } from "../../src";

describe("skills config reader backfill", () => {
	test("backfills missing skills policy and persists it once", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-skills-config-"));
		const configPath = join(repo, ".mimirmesh", "config.yml");
		const legacyConfig = createDefaultConfig(repo) as Record<string, unknown>;
		delete legacyConfig.skills;

		await mkdir(join(repo, ".mimirmesh"), { recursive: true });
		await writeFile(configPath, stringify(legacyConfig), "utf8");

		try {
			const loaded = await readConfig(repo, { createIfMissing: false });
			expect(loaded.skills.embeddings.enabled).toBe(false);
			expect(loaded.skills.resolve.precedence).toContain("embeddings");

			const persistedOnce = await readFile(configPath, "utf8");
			expect(parse(persistedOnce)).toMatchObject({
				skills: {
					read: {
						defaultMode: "memory",
					},
				},
			});

			await readConfig(repo, { createIfMissing: false });
			const persistedTwice = await readFile(configPath, "utf8");
			expect(persistedTwice).toBe(persistedOnce);
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});
});
