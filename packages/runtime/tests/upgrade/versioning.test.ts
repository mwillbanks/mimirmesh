import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createRuntimeUpgradeFixture } from "@mimirmesh/testing";

import {
	CURRENT_RUNTIME_SCHEMA_VERSION,
	createTargetVersionRecord,
	detectProjectRuntimeVersion,
	isAutomaticMigrationAllowed,
	requiresMigration,
} from "../../src/upgrade/versioning";

describe("runtime upgrade versioning", () => {
	test("detects legacy runtime state without version.json", async () => {
		const fixture = await createRuntimeUpgradeFixture("legacy");
		try {
			const detected = await detectProjectRuntimeVersion(fixture.repo);
			expect(detected?.runtimeSchemaVersion).toBe(1);
			expect(isAutomaticMigrationAllowed(detected)).toBe(true);
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});

	test("detects outdated supported state and migration need", async () => {
		const fixture = await createRuntimeUpgradeFixture("outdated");
		try {
			const detected = await detectProjectRuntimeVersion(fixture.repo);
			expect(detected?.runtimeSchemaVersion).toBeLessThan(CURRENT_RUNTIME_SCHEMA_VERSION);
			expect(requiresMigration(detected, createTargetVersionRecord("test"))).toBe(true);
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});

	test("blocks automatic migration outside compatibility window", async () => {
		const fixture = await createRuntimeUpgradeFixture("blocked");
		try {
			const detected = await detectProjectRuntimeVersion(fixture.repo);
			expect(isAutomaticMigrationAllowed(detected)).toBe(false);
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});
});
