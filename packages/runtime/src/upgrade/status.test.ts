import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createRuntimeUpgradeFixture } from "@mimirmesh/testing";

import { classifyUpgradeStatus } from "./status";

describe("runtime upgrade status", () => {
	test("classifies current runtime", async () => {
		const fixture = await createRuntimeUpgradeFixture("current");
		try {
			const status = await classifyUpgradeStatus(fixture.repo, fixture.config);
			expect(status.report.state).toBe("current");
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});

	test("classifies outdated runtime", async () => {
		const fixture = await createRuntimeUpgradeFixture("outdated");
		try {
			const status = await classifyUpgradeStatus(fixture.repo, fixture.config);
			expect(status.report.state).toBe("outdated");
			expect(status.report.requiredActions).toContain("migrate-state");
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});

	test("classifies blocked runtime outside compatibility window", async () => {
		const fixture = await createRuntimeUpgradeFixture("blocked");
		try {
			const status = await classifyUpgradeStatus(fixture.repo, fixture.config);
			expect(status.report.state).toBe("blocked");
			expect(status.report.requiredActions).toContain("manual-intervention");
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});

	test("classifies degraded runtime with quarantined preserved assets", async () => {
		const fixture = await createRuntimeUpgradeFixture("degraded");
		try {
			const status = await classifyUpgradeStatus(fixture.repo, fixture.config);
			expect(status.report.state).toBe("degraded");
			expect(status.report.driftCategories).toContain("preserved-asset-validation");
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});
});
