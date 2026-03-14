import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { createDefaultConfig } from "@mimirmesh/config";
import {
	detectDockerAvailability,
	generateRuntimeFiles,
	loadBootstrapState,
	loadEngineState,
	loadRuntimeConnection,
} from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";
import { loadCliContext, runtimeAction } from "apps/cli/src/lib/context";

describe("integration runtime lifecycle", () => {
	test("keeps bootstrap gating intact across gpuMode variants before runtime start", async () => {
		const repo = await createFixtureCopy("single-ts", { initializeGit: true });
		try {
			for (const gpuMode of ["auto", "off", "on"] as const) {
				const config = createDefaultConfig(repo);
				config.runtime.gpuMode = gpuMode;
				await generateRuntimeFiles(repo, config);

				const bootstrap = await loadBootstrapState(repo);
				const srclightState = await loadEngineState(repo, "srclight");
				const srclightBootstrap = bootstrap?.engines.find((entry) => entry.engine === "srclight");

				expect(srclightBootstrap?.mode).toBe("command");
				expect(srclightBootstrap?.completed).toBe(false);
				expect(srclightState?.runtimeEvidence?.gpuMode).toBe(gpuMode);
				expect(["cpu", "cuda"]).toContain(srclightState?.runtimeEvidence?.runtimeVariant ?? "cpu");
			}
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});

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
			expect(bootstrap?.engines.some((entry) => entry.engine === "srclight")).toBe(true);

			let status = await runtimeAction(context, "status");
			expect(status.action).toBe("status");
			expect(status.runtimeVersion?.runtimeSchemaVersion).toBeGreaterThanOrEqual(4);

			let srclightState = await loadEngineState(repo, "srclight");

			for (let attempt = 0; attempt < 5; attempt += 1) {
				if (typeof srclightState?.runtimeEvidence?.gitBinaryAvailable === "boolean") {
					break;
				}
				await new Promise((resolve) => setTimeout(resolve, 500));
				status = await runtimeAction(context, "status");
				srclightState = await loadEngineState(repo, "srclight");
			}

			expect(srclightState?.runtimeEvidence?.bootstrapMode).toBe("command");
			expect(srclightState?.runtimeEvidence?.gitBinaryAvailable).toBe(true);
			expect(srclightState?.runtimeEvidence?.gitWorkTreeAccessible).toBe(true);

			const refreshed = await runtimeAction(context, "refresh");
			expect(refreshed.action).toBe("refresh");
			const connection = await loadRuntimeConnection(repo);
			expect(connection?.startedAt).not.toBeNull();

			const stopped = await runtimeAction(context, "stop");
			expect(stopped.action).toBe("stop");
		} finally {
			await runtimeAction(context, "stop");
			await rm(repo, { recursive: true, force: true });
		}
	}, 120_000);

	test("preserves base runtime availability when embedding bootstrap degrades", async () => {
		const docker = await detectDockerAvailability();
		if (!docker.dockerInstalled || !docker.dockerDaemonRunning || !docker.composeAvailable) {
			return;
		}

		const repo = await createFixtureCopy("single-ts", { initializeGit: true });
		const context = await loadCliContext(repo);
		try {
			await runtimeAction(context, "start");

			let status = await runtimeAction(context, "status");
			let srclightState = await loadEngineState(repo, "srclight");

			for (let attempt = 0; attempt < 5; attempt += 1) {
				if (srclightState?.lastBootstrapResult && srclightState.lastBootstrapResult !== "pending") {
					break;
				}
				await new Promise((resolve) => setTimeout(resolve, 500));
				status = await runtimeAction(context, "status");
				srclightState = await loadEngineState(repo, "srclight");
			}

			expect(srclightState?.health.state).toBe("healthy");
			expect(["success", "failed", "pending"]).toContain(
				srclightState?.lastBootstrapResult ?? "failed",
			);
			if (srclightState?.lastBootstrapResult === "failed") {
				expect(status.health.state).toBe("degraded");
				expect(
					srclightState.capabilityWarnings?.some((warning) =>
						warning.includes("semantic_search unavailable"),
					),
				).toBe(true);
			}
		} finally {
			await runtimeAction(context, "stop");
			await rm(repo, { recursive: true, force: true });
		}
	}, 120_000);
});
