import { describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parse } from "yaml";

import { readConfig } from "../../src/readers";

const stageFixture = async (fixtureName: string): Promise<{ repo: string; configPath: string }> => {
	const repo = await mkdtemp(join(tmpdir(), "mimirmesh-config-migration-failure-"));
	const configPath = join(repo, ".mimirmesh", "config.yml");
	const template = await readFile(new URL(`../fixtures/${fixtureName}`, import.meta.url), "utf8");

	await mkdir(join(repo, ".mimirmesh"), { recursive: true });
	await writeFile(configPath, template.replaceAll("__PROJECT_ROOT__", repo), "utf8");

	return { repo, configPath };
};

describe("legacy codebase-memory migration failure", () => {
	test("fails config load when migrated config cannot be written back", async () => {
		const { repo, configPath } = await stageFixture("legacy-write-failure.yml");

		try {
			await chmod(configPath, 0o444);

			await expect(readConfig(repo, { createIfMissing: false })).rejects.toThrow(
				/Failed to persist migrated legacy codebase-memory config/,
			);

			const persisted = parse(await readFile(configPath, "utf8")) as {
				engines: Record<string, unknown>;
			};
			expect(persisted.engines["codebase-memory-mcp"]).toBeDefined();
		} finally {
			await chmod(configPath, 0o644).catch(() => undefined);
			await rm(repo, { recursive: true, force: true });
		}
	});
});
