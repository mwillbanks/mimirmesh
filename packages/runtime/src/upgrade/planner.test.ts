import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createRuntimeUpgradeFixture } from "@mimirmesh/testing";

import { planRuntimeMigrations } from "./planner";

describe("runtime upgrade planner", () => {
	test("returns no-op plan for current runtime", async () => {
		const fixture = await createRuntimeUpgradeFixture("current");
		try {
			const plan = await planRuntimeMigrations(fixture.repo);
			expect(plan.steps).toHaveLength(0);
			expect(plan.automaticMigrationAllowed).toBe(true);
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});

	test("returns ordered migration steps for supported older runtime", async () => {
		const fixture = await createRuntimeUpgradeFixture("outdated");
		try {
			const plan = await planRuntimeMigrations(fixture.repo);
			expect(plan.steps.map((step) => step.id)).toEqual([
				"001-init-runtime",
				"002-compose-layout",
				"003-engine-state",
			]);
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});
});
