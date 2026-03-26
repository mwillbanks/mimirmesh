import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { createInstallationPolicy } from "@mimirmesh/installer";
import { runtimeStop } from "@mimirmesh/runtime";
import { createFixtureCopy, createSpecifyStub } from "@mimirmesh/testing";
import { executeWorkflowRun, type PresentationProfile } from "@mimirmesh/ui";

import {
	loadCliContext,
	loadCliPreviewContext,
	previewInstallExecution,
} from "../../src/lib/context";
import { createInstallWorkflow } from "../../src/workflows/install";

const presentation: PresentationProfile = {
	mode: "direct-human",
	interactive: false,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "wide",
};

describe("install rerun workflow", () => {
	const originalProjectRoot = process.env.MIMIRMESH_PROJECT_ROOT;
	const originalSpecify = process.env.MIMIRMESH_SPECIFY_BIN;
	const ciSafeTest = process.env.CI === "true" ? test.skip : test;

	afterEach(() => {
		process.env.MIMIRMESH_PROJECT_ROOT = originalProjectRoot;
		process.env.MIMIRMESH_SPECIFY_BIN = originalSpecify;
	});

	ciSafeTest(
		"requires confirmation for install-managed updates on rerun and succeeds when confirmed",
		async () => {
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

				const context = await loadCliPreviewContext(repo);
				const preview = await previewInstallExecution(context, policy);
				expect(preview.summary.updatedFiles.length).toBeGreaterThan(0);

				const blocked = await executeWorkflowRun(createInstallWorkflow({ policy }), presentation);
				expect(blocked.outcome?.kind).toBe("failed");

				const confirmed = await executeWorkflowRun(
					createInstallWorkflow({
						policy,
						confirmedUpdatedFiles: preview.summary.updatedFiles,
					}),
					presentation,
				);
				expect(confirmed.outcome?.message).not.toContain("interactive confirmation");
				expect(confirmed.steps.find((step) => step.id === "detect-install-state")?.status).toBe(
					"completed",
				);
			} finally {
				const context = await loadCliContext(repo);
				await runtimeStop(repo, context.config, context.logger);
				await rm(repo, { recursive: true, force: true });
			}
		},
		180_000,
	);

	ciSafeTest(
		"does not mark runtime artifacts as updates during first preview on a clean repository",
		async () => {
			const repo = await createFixtureCopy("single-ts", { initializeGit: true });
			try {
				process.env.MIMIRMESH_PROJECT_ROOT = repo;
				process.env.MIMIRMESH_SPECIFY_BIN = await createSpecifyStub(
					join(repo, ".mimirmesh", "testing"),
				);
				const policy = createInstallationPolicy({
					presetId: "full",
					mode: "interactive",
					selectedAreas: ["core", "ide", "skills"],
					explicitAreaOverrides: ["core", "ide", "skills"],
					ideTargets: ["vscode", "codex"],
				});

				const previewContext = await loadCliPreviewContext(repo);
				const preview = await previewInstallExecution(previewContext, policy);

				expect(preview.summary.updatedFiles).toEqual([]);
				expect(preview.summary.createdFiles).toContain(
					join(repo, ".mimirmesh", "runtime", "routing-table.json"),
				);
				expect(preview.summary.createdFiles).toContain(
					join(repo, ".mimirmesh", "runtime", "engines", "srclight.json"),
				);
			} finally {
				const context = await loadCliContext(repo);
				await runtimeStop(repo, context.config, context.logger);
				await rm(repo, { recursive: true, force: true });
			}
		},
		180_000,
	);
});
