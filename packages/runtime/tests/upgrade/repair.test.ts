import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createRuntimeUpgradeFixture } from "@mimirmesh/testing";

import { repairRuntime } from "../../src/upgrade/repair";

describe("runtime upgrade repair", () => {
	test("resumes or repairs a repairable runtime", async () => {
		const fixture = await createRuntimeUpgradeFixture("repairable");
		try {
			const result = await repairRuntime(fixture.repo, fixture.config);
			expect(result.ok).toBe(true);
			expect(["success", "degraded"]).toContain(result.outcome?.result ?? "failed");
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});

	test("reports blocked state without mutating unsupported runtime", async () => {
		const fixture = await createRuntimeUpgradeFixture("blocked");
		try {
			const result = await repairRuntime(fixture.repo, fixture.config);
			expect(result.ok).toBe(false);
			expect(result.outcome?.result).toBe("blocked");
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});
});
