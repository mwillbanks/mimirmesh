import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { stringify } from "yaml";

import { createDefaultConfig, readConfig } from "../../src";

describe("config reader mcp backfill", () => {
	test("backfills the mcp tool-surface block for older configs and persists it once", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-config-mcp-backfill-"));
		const configPath = join(repo, ".mimirmesh", "config.yml");
		const legacyConfig = createDefaultConfig(repo) as Record<string, unknown>;

		delete legacyConfig.mcp;
		await mkdir(join(repo, ".mimirmesh"), { recursive: true });
		await writeFile(configPath, stringify(legacyConfig), "utf8");

		try {
			const migrated = await readConfig(repo, { createIfMissing: false });

			expect(migrated.mcp.toolSurface).toMatchObject({
				compressionLevel: "balanced",
				coreEngineGroups: [],
				deferredEngineGroups: ["srclight", "document-mcp", "mcp-adr-analysis-server"],
				deferredVisibility: "summary",
				fullSchemaAccess: true,
				refreshPolicy: "explicit",
				allowInvocationLazyLoad: true,
			});

			const persistedOnce = await readFile(configPath, "utf8");
			await readConfig(repo, { createIfMissing: false });
			const persistedTwice = await readFile(configPath, "utf8");

			expect(persistedTwice).toBe(persistedOnce);
			expect(persistedOnce).toContain("mcp:");
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});
});
