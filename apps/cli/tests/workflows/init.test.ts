import { afterEach, describe, expect, test } from "bun:test";
import { access, rm } from "node:fs/promises";
import { join } from "node:path";

import { runtimeStop } from "@mimirmesh/runtime";
import { createFixtureCopy, createSpecifyStub } from "@mimirmesh/testing";
import { executeWorkflowRun, type PresentationProfile } from "@mimirmesh/ui";

import { loadCliContext } from "../../src/lib/context";
import { createInitWorkflow } from "../../src/workflows/init";

const presentation: PresentationProfile = {
	mode: "direct-human",
	interactive: false,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "wide",
};

const exists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

describe("init workflow", () => {
	const originalProjectRoot = process.env.MIMIRMESH_PROJECT_ROOT;
	const originalSpecify = process.env.MIMIRMESH_SPECIFY_BIN;
	const ciSafeTest = process.env.CI === "true" ? test.skip : test;

	afterEach(() => {
		process.env.MIMIRMESH_PROJECT_ROOT = originalProjectRoot;
		process.env.MIMIRMESH_SPECIFY_BIN = originalSpecify;
	});

	ciSafeTest(
		"initializes runtime files and records degraded or ready verification evidence",
		async () => {
			const repo = await createFixtureCopy("single-ts", { initializeGit: true });
			try {
				process.env.MIMIRMESH_PROJECT_ROOT = repo;
				process.env.MIMIRMESH_SPECIFY_BIN = await createSpecifyStub(
					join(repo, ".mimirmesh", "testing"),
				);

				const finalState = await executeWorkflowRun(createInitWorkflow(), presentation);

				expect(["success", "degraded", "failed"]).toContain(finalState.phase);
				expect(finalState.steps.find((step) => step.id === "initialize-project")?.status).toBe(
					"completed",
				);
				expect(await exists(join(repo, ".mimirmesh", "config.yml"))).toBe(true);
				expect(await exists(join(repo, "docs", "adr"))).toBe(true);
				expect(await exists(join(repo, "docs", "decisions"))).toBe(false);
				expect(await exists(join(repo, ".mimirmesh", "reports", "project-summary.md"))).toBe(true);
				expect(finalState.outcome?.evidence?.some((row) => row.label === "Repo shape")).toBe(true);
			} finally {
				const context = await loadCliContext(repo);
				await runtimeStop(repo, context.config, context.logger);
				await rm(repo, { recursive: true, force: true });
			}
		},
		180_000,
	);
});
