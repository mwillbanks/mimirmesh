import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { createInstallationPolicy } from "@mimirmesh/installer";
import { runtimeStop } from "@mimirmesh/runtime";
import { createFixtureCopy, createSpecifyStub } from "@mimirmesh/testing";
import { executeWorkflowRun, type PresentationProfile } from "@mimirmesh/ui";

import { loadCliContext } from "../../src/lib/context";
import { createInstallWorkflow } from "../../src/workflows/install";

const presentation: PresentationProfile = {
	mode: "direct-human",
	interactive: false,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "wide",
};

describe("install runtime verification", () => {
	const originalProjectRoot = process.env.MIMIRMESH_PROJECT_ROOT;
	const originalSpecify = process.env.MIMIRMESH_SPECIFY_BIN;

	afterEach(() => {
		process.env.MIMIRMESH_PROJECT_ROOT = originalProjectRoot;
		process.env.MIMIRMESH_SPECIFY_BIN = originalSpecify;
	});

	test("reports the machine-readable install payload with runtime status", async () => {
		const repo = await createFixtureCopy("single-ts", { initializeGit: true });
		try {
			process.env.MIMIRMESH_PROJECT_ROOT = repo;
			process.env.MIMIRMESH_SPECIFY_BIN = await createSpecifyStub(
				join(repo, ".mimirmesh", "testing"),
			);
			const policy = createInstallationPolicy({
				presetId: "minimal",
				mode: "non-interactive",
				selectedAreas: ["core"],
				explicitAreaOverrides: ["core"],
			});

			const finalState = await executeWorkflowRun(createInstallWorkflow({ policy }), presentation);
			const payload = finalState.outcome?.machineReadablePayload as
				| {
						selectedPreset: string;
						selectedAreas: string[];
						completedAreas: string[];
						runtimeStatus: { state: string };
				  }
				| undefined;

			expect(payload?.selectedPreset).toBe("minimal");
			expect(payload?.selectedAreas).toContain("core");
			expect(["ready", "degraded", "bootstrapping", "failed"]).toContain(
				payload?.runtimeStatus.state ?? "",
			);
		} finally {
			const context = await loadCliContext(repo);
			await runtimeStop(repo, context.config, context.logger);
			await rm(repo, { recursive: true, force: true });
		}
	}, 180_000);
});
