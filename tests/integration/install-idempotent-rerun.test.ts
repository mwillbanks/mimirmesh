import { afterEach, describe, expect, test } from "bun:test";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { createInstallationPolicy } from "@mimirmesh/installer";
import { runtimeStop } from "@mimirmesh/runtime";
import { createFixtureCopy, createSpecifyStub } from "@mimirmesh/testing";
import { executeWorkflowRun, type PresentationProfile } from "@mimirmesh/ui";

import { loadCliContext, previewInstallExecution } from "apps/cli/src/lib/context";
import { createInstallWorkflow } from "apps/cli/src/workflows/install";

const presentation: PresentationProfile = {
	mode: "direct-human",
	interactive: false,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "wide",
};

describe("integration install idempotent rerun", () => {
	afterEach(() => {
		delete process.env.MIMIRMESH_SPECIFY_BIN;
		delete process.env.MIMIRMESH_PROJECT_ROOT;
	});

	test("reruns without duplicating the guidance file contents", async () => {
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
			const guidancePath = join(repo, "docs", "operations", "mimirmesh-guidance.md");
			const before = await readFile(guidancePath, "utf8");
			const context = await loadCliContext(repo);
			const preview = await previewInstallExecution(context, policy);

			await executeWorkflowRun(
				createInstallWorkflow({
					policy,
					confirmedUpdatedFiles: preview.summary.updatedFiles,
				}),
				presentation,
			);

			const after = await readFile(guidancePath, "utf8");
			expect(after).toBe(before);
			expect(after.match(/mimirmesh install/g)?.length ?? 0).toBe(1);
		} finally {
			const context = await loadCliContext(repo);
			await runtimeStop(repo, context.config, context.logger);
			await rm(repo, { recursive: true, force: true });
		}
	}, 360_000);
});
