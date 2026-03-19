import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parse } from "yaml";

import { readConfig } from "../../src/readers";

const stageFixture = async (fixtureName: string): Promise<{ repo: string; configPath: string }> => {
	const repo = await mkdtemp(join(tmpdir(), "mimirmesh-config-overlap-"));
	const configPath = join(repo, ".mimirmesh", "config.yml");
	const template = await readFile(new URL(`../fixtures/${fixtureName}`, import.meta.url), "utf8");

	await mkdir(join(repo, ".mimirmesh"), { recursive: true });
	await writeFile(configPath, template.replaceAll("__PROJECT_ROOT__", repo), "utf8");

	return { repo, configPath };
};

describe("legacy codebase-memory migration precedence", () => {
	test("preserves explicit srclight values when legacy and srclight overlap", async () => {
		const { repo, configPath } = await stageFixture("legacy-and-srclight-overlap.yml");

		try {
			const migrated = await readConfig(repo, { createIfMissing: false });
			expect(migrated.engines.srclight.settings).toMatchObject({
				rootPath: "/workspace/current-root",
				indexOnStart: false,
			});

			const persisted = parse(await readFile(configPath, "utf8")) as {
				engines: Record<string, { settings?: Record<string, unknown> }>;
			};

			expect(persisted.engines["codebase-memory-mcp"]).toBeUndefined();
			expect(persisted.engines.srclight?.settings?.rootPath).toBe("/workspace/current-root");
			expect(persisted.engines.srclight?.settings?.indexOnStart).toBe(false);
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});
});
