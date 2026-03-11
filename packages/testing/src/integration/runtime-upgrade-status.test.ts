import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import {
	loadCliContext,
	runtimeDoctor,
	runtimeUpgradeStatus,
} from "../../../../apps/cli/src/lib/context";
import { createRuntimeUpgradeFixture } from "../fixtures/runtime-upgrade";

describe("integration runtime upgrade status", () => {
	test.each([
		["current", "current"],
		["outdated", "outdated"],
		["blocked", "blocked"],
		["degraded", "degraded"],
	] as const)("classifies %s runtime", async (fixtureState, expected) => {
		const fixture = await createRuntimeUpgradeFixture(fixtureState);
		try {
			const context = await loadCliContext(fixture.repo);
			const result = await runtimeUpgradeStatus(context);
			expect(result.report.state).toBe(expected);
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});

	test("runs runtime doctor validation without quarantining assets", async () => {
		const fixture = await createRuntimeUpgradeFixture("current");
		try {
			const context = await loadCliContext(fixture.repo);
			const result = await runtimeDoctor(context);
			expect(result.warnings).toEqual([]);
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});
});
