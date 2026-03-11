import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { loadCliContext, runtimeUpgradeRepair } from "../../../../apps/cli/src/lib/context";
import { createRuntimeUpgradeFixture } from "../fixtures/runtime-upgrade";

describe("integration runtime upgrade repair", () => {
	test("repairs resumable runtime state", async () => {
		const fixture = await createRuntimeUpgradeFixture("repairable");
		try {
			const context = await loadCliContext(fixture.repo);
			const result = await runtimeUpgradeRepair(context);
			expect(result.ok).toBe(true);
			expect(["success", "degraded"]).toContain(result.outcome?.result ?? "failed");
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});
});
