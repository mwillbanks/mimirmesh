import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createRuntimeUpgradeFixture } from "@mimirmesh/testing";

import {
	completeCheckpointStep,
	createUpgradeCheckpoint,
	failCheckpointStep,
	loadCheckpoint,
	quarantineCheckpointStep,
	startCheckpointStep,
} from "./checkpoints";
import { createTargetVersionRecord } from "./versioning";

describe("runtime upgrade checkpoints", () => {
	test("persists ordered step completion and resume state", async () => {
		const fixture = await createRuntimeUpgradeFixture("current");
		try {
			let checkpoint = createUpgradeCheckpoint({
				upgradeId: "checkpoint-test",
				targetVersion: createTargetVersionRecord("test"),
			});
			checkpoint = await startCheckpointStep({
				projectRoot: fixture.repo,
				checkpoint,
				stepId: "001-init-runtime",
			});
			checkpoint = await completeCheckpointStep({
				projectRoot: fixture.repo,
				checkpoint,
				stepId: "001-init-runtime",
			});
			checkpoint = await startCheckpointStep({
				projectRoot: fixture.repo,
				checkpoint,
				stepId: "002-compose-layout",
			});
			checkpoint = await quarantineCheckpointStep({
				projectRoot: fixture.repo,
				checkpoint,
				stepId: "002-compose-layout",
				failureReason: "validation degraded",
			});

			const loaded = await loadCheckpoint(fixture.repo);
			expect(loaded?.completedStepIds).toEqual(["001-init-runtime"]);
			expect(loaded?.quarantinedStepIds).toEqual(["002-compose-layout"]);
			expect(loaded?.resumeAllowed).toBe(true);
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});

	test("records blocking failure state", async () => {
		const fixture = await createRuntimeUpgradeFixture("current");
		try {
			let checkpoint = createUpgradeCheckpoint({
				upgradeId: "checkpoint-failure",
				targetVersion: createTargetVersionRecord("test"),
			});
			checkpoint = await failCheckpointStep({
				projectRoot: fixture.repo,
				checkpoint,
				stepId: "003-engine-state",
				failureReason: "engine state step failed",
				resumeAllowed: false,
			});

			expect(checkpoint.failureReason).toContain("failed");
			expect(checkpoint.resumeAllowed).toBe(false);
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});
});
