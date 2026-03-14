import { describe, expect, test } from "bun:test";
import { access, rm } from "node:fs/promises";
import { loadVersionRecord } from "@mimirmesh/runtime";

import { loadCliContext, runtimeUpgradeMigrate } from "apps/cli/src/lib/context";
import { createRuntimeUpgradeFixture } from "@mimirmesh/testing";

const pathExists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

describe("integration runtime upgrade no-op", () => {
	test("keeps current runtime in place without deleting .mimirmesh", async () => {
		const fixture = await createRuntimeUpgradeFixture("current");
		try {
			const context = await loadCliContext(fixture.repo);
			const result = await runtimeUpgradeMigrate(context);
			const version = await loadVersionRecord(fixture.repo);

			expect(result.ok).toBe(true);
			expect(result.outcome?.result).toBe("success");
			expect(await pathExists(`${fixture.repo}/.mimirmesh`)).toBe(true);
			expect(version?.runtimeSchemaVersion).toBeGreaterThanOrEqual(4);
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});
});
