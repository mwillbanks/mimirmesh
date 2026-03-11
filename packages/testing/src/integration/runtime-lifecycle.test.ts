import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { detectDockerAvailability, loadBootstrapState, loadEngineState } from "@mimirmesh/runtime";
import { loadCliContext, runtimeAction } from "../../../../apps/cli/src/lib/context";

import { createFixtureCopy } from "../fixtures";

describe("integration runtime lifecycle", () => {
	test("start/stop/status commands complete", async () => {
		const docker = await detectDockerAvailability();
		if (!docker.dockerInstalled || !docker.dockerDaemonRunning || !docker.composeAvailable) {
			return;
		}

		const repo = await createFixtureCopy("single-ts", { initializeGit: true });
		const context = await loadCliContext(repo);
		try {
			const started = await runtimeAction(context, "start");
			expect(started.action).toBe("start");

			const bootstrap = await loadBootstrapState(repo);
			const srclightState = await loadEngineState(repo, "srclight");
			expect(bootstrap?.engines.some((entry) => entry.engine === "srclight")).toBe(true);
			expect(srclightState?.runtimeEvidence?.bootstrapMode).toBe("command");
			expect(srclightState?.runtimeEvidence?.gitBinaryAvailable).toBe(true);
			expect(srclightState?.runtimeEvidence?.gitWorkTreeAccessible).toBe(true);

			const status = await runtimeAction(context, "status");
			expect(status.action).toBe("status");
			expect(status.runtimeVersion?.runtimeSchemaVersion).toBeGreaterThanOrEqual(4);

			const refreshed = await runtimeAction(context, "refresh");
			expect(refreshed.action).toBe("refresh");

			const stopped = await runtimeAction(context, "stop");
			expect(stopped.action).toBe("stop");
		} finally {
			await runtimeAction(context, "stop");
			await rm(repo, { recursive: true, force: true });
		}
	}, 120_000);
});
