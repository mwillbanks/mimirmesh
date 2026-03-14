import { describe, expect, test } from "bun:test";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createRuntimeUpgradeFixture } from "@mimirmesh/testing";

import { createBackupManifest, restoreBackupManifest } from "../../src/upgrade/backups";

describe("runtime upgrade backups", () => {
	test("creates restorable metadata backups", async () => {
		const fixture = await createRuntimeUpgradeFixture("current");
		try {
			const connectionPath = join(fixture.repo, ".mimirmesh", "runtime", "connection.json");
			const original = await readFile(connectionPath, "utf8");
			const manifest = await createBackupManifest({
				projectRoot: fixture.repo,
				upgradeId: "backup-test",
				targets: [{ path: connectionPath, category: "runtime-metadata" }],
			});
			await writeFile(connectionPath, '{"mutated":true}\n', "utf8");

			const restored = await restoreBackupManifest({ projectRoot: fixture.repo });
			expect(manifest.artifacts).toHaveLength(1);
			expect(restored).toHaveLength(1);
			expect(await readFile(connectionPath, "utf8")).toBe(original);
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});
});
