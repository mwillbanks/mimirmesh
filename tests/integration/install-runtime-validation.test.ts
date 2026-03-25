import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { createInstallationPolicy } from "@mimirmesh/installer";
import { runtimeStop } from "@mimirmesh/runtime";
import { createFixtureCopy, createSpecifyStub } from "@mimirmesh/testing";
import { executeWorkflowRun, type PresentationProfile } from "@mimirmesh/ui";

import { loadCliContext, mcpListTools, runtimeAction } from "apps/cli/src/lib/context";
import { createInstallWorkflow } from "apps/cli/src/workflows/install";

const presentation: PresentationProfile = {
	mode: "direct-human",
	interactive: false,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "wide",
};

describe("integration install runtime validation", () => {
	afterEach(() => {
		delete process.env.MIMIRMESH_SPECIFY_BIN;
		delete process.env.MIMIRMESH_PROJECT_ROOT;
	});

	test("reports runtime validation after install and keeps transport-safe tool names", async () => {
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

			await executeWorkflowRun(createInstallWorkflow({ policy }), presentation);
			const context = await loadCliContext(repo);
			const runtime = await runtimeAction(context, "status");
			expect(["ready", "degraded", "bootstrapping", "failed"]).toContain(runtime.health.state);

			const tools = await mcpListTools(context);
			expect(tools.every((tool) => !tool.name.includes("."))).toBe(true);
		} finally {
			const context = await loadCliContext(repo);
			await runtimeStop(repo, context.config, context.logger);
			await rm(repo, { recursive: true, force: true });
		}
	}, 360_000);
});
