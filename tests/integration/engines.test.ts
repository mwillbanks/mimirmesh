import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createDefaultConfig, writeConfig } from "@mimirmesh/config";
import {
	detectDockerAvailability,
	loadBootstrapState,
	loadEngineState,
	loadRoutingTable,
	resolveGpuPolicy,
	runtimeStart,
	runtimeStatus,
	runtimeStop,
} from "@mimirmesh/runtime";

import { createFixtureCopy } from "@mimirmesh/testing";

describe("engine integration", () => {
	test("resolves gpuMode variants into expected runtime selection and diagnostics", async () => {
		const projectRoot = "/tmp/mimirmesh-engine-gpu";
		const config = createDefaultConfig(projectRoot);

		config.runtime.gpuMode = "off";
		const offResolution = await resolveGpuPolicy(config);
		expect(offResolution.engines.srclight).toEqual(
			expect.objectContaining({
				configuredMode: "off",
				effectiveUseGpu: false,
				runtimeVariant: "cpu",
			}),
		);

		config.runtime.gpuMode = "on";
		const onResolution = await resolveGpuPolicy(config);
		expect(onResolution.engines.srclight).toEqual(
			expect.objectContaining({
				configuredMode: "on",
				effectiveUseGpu: true,
				runtimeVariant: "cuda",
			}),
		);
		if (!onResolution.engines.srclight?.hostNvidiaAvailable) {
			expect(onResolution.engines.srclight?.startupBlocked).toBe(true);
			expect(onResolution.engines.srclight?.startupBlockReason).toContain("runtime.gpuMode=on");
		}
	});

	test("builds, starts, discovers tools, and records bootstrap state", async () => {
		const docker = await detectDockerAvailability();
		if (!docker.dockerInstalled || !docker.dockerDaemonRunning || !docker.composeAvailable) {
			return;
		}

		const repo = await createFixtureCopy("single-ts", { initializeGit: true });
		const config = createDefaultConfig(repo);
		await writeConfig(repo, config);
		try {
			const started = await runtimeStart(repo, config);
			expect(started.action).toBe("start");
			const status = await runtimeStatus(repo, config);

			const routing = await loadRoutingTable(repo);
			const bootstrap = await loadBootstrapState(repo);

			const engines = ["srclight", "document-mcp", "mcp-adr-analysis-server"] as const;

			for (const engine of engines) {
				const state = await loadEngineState(repo, engine);
				expect(state?.engine).toBe(engine);
				expect(Array.isArray(state?.discoveredTools)).toBe(true);
			}

			expect(Boolean(routing)).toBe(true);
			expect((bootstrap?.engines.map((entry) => entry.engine) ?? []) as string[]).not.toContain(
				"codebase-memory-mcp",
			);
			expect(bootstrap?.engines.find((entry) => entry.engine === "document-mcp")).toEqual(
				expect.objectContaining({
					mode: "none",
					completed: true,
				}),
			);
			expect(
				bootstrap?.engines.find((entry) => entry.engine === "mcp-adr-analysis-server"),
			).toEqual(
				expect.objectContaining({
					mode: "none",
					completed: true,
				}),
			);
			const srclightBootstrap = bootstrap?.engines.find((entry) => entry.engine === "srclight");
			expect(["command", "none"]).toContain(srclightBootstrap?.mode ?? "none");
			if (srclightBootstrap?.mode === "command") {
				expect(srclightBootstrap.command).toBe("srclight");
				expect(srclightBootstrap.args?.[0]).toBe("index");
			}

			const srclightState = await loadEngineState(repo, "srclight");
			expect(srclightState?.bridge.transport).toBe("sse");
			expect(srclightState?.runtimeEvidence?.bootstrapMode).toBe("command");
			expect(srclightState?.runtimeEvidence?.gpuMode).toBe("auto");
			expect(["cpu", "cuda"]).toContain(srclightState?.runtimeEvidence?.runtimeVariant ?? "cpu");
			if ((srclightState?.discoveredTools.length ?? 0) > 0) {
				expect(srclightState?.runtimeEvidence?.gitBinaryAvailable).toBe(true);
				expect(srclightState?.runtimeEvidence?.gitRepoVisible).toBe(true);
				expect(srclightState?.runtimeEvidence?.gitWorkTreeAccessible).toBe(true);
				expect(routing?.passthrough.some((route) => route.engine === "srclight")).toBe(true);
				expect(
					routing?.unified.some((route) => route.unifiedTool === "document_architecture"),
				).toBe(true);
				for (const unifiedTool of [
					"find_tests",
					"inspect_type_hierarchy",
					"inspect_platform_code",
					"list_workspace_projects",
					"refresh_index",
				]) {
					expect(routing?.unified.some((route) => route.unifiedTool === unifiedTool)).toBe(true);
				}
			} else {
				expect(["degraded", "failed"]).toContain(status.health.state);
				expect(
					status.health.reasons.some(
						(reason) =>
							reason.includes("srclight") ||
							reason.includes("unified routes") ||
							reason.includes("runtime service"),
					),
				).toBe(true);
			}

			if (
				srclightState?.lastBootstrapResult === "failed" ||
				(srclightState?.discoveredTools.length ?? 0) === 0
			) {
				const capabilityWarnings = srclightState?.capabilityWarnings ?? [];
				expect(srclightState?.health.state).toBe("unhealthy");
				expect(["degraded", "failed"]).toContain(status.health.state);
				expect(
					capabilityWarnings.length > 0 ||
						status.health.reasons.some((reason) => reason.includes("srclight")),
				).toBe(true);
			} else {
				expect(srclightState?.health.state).toBe("healthy");
				expect(srclightState?.capabilityWarnings).toEqual([]);
				expect(status.health.reasons.some((reason) => reason.includes("srclight"))).toBe(false);
			}
		} finally {
			await runtimeStop(repo, config);
			await rm(repo, { recursive: true, force: true });
		}
	}, 300_000);

	test("surfaces degraded engine state for missing optional config", async () => {
		const docker = await detectDockerAvailability();
		if (!docker.dockerInstalled || !docker.dockerDaemonRunning || !docker.composeAvailable) {
			return;
		}

		const repo = await createFixtureCopy("single-ts", { initializeGit: true });
		const config = createDefaultConfig(repo);
		const srclightSettings = config.engines.srclight.settings as {
			transport: "stdio" | "sse";
			port: number;
			rootPath: string;
			indexOnStart: boolean;
			embedModel: string | null;
			defaultEmbedModel: string;
			ollamaBaseUrl: string | null;
			embedRequestTimeoutSeconds: number;
		};
		config.engines.srclight.settings = {
			...srclightSettings,
			embedModel: "nomic-embed-text",
			ollamaBaseUrl: null,
		};
		config.engines.srclight.required = false;
		try {
			await writeConfig(repo, config);
			await runtimeStart(repo, config);
			const state = await loadEngineState(repo, "srclight");
			const status = await runtimeStatus(repo, config);

			expect(state?.engine).toBe("srclight");
			expect(["ready", "degraded", "bootstrapping", "failed"]).toContain(status.health.state);
		} finally {
			await runtimeStop(repo, config);
			await rm(repo, { recursive: true, force: true });
		}
	}, 300_000);
});
