import { afterEach, describe, expect, test } from "bun:test";
import { access, rm } from "node:fs/promises";
import { join } from "node:path";

import { createInstallationPolicy } from "@mimirmesh/installer";
import { runtimeStop } from "@mimirmesh/runtime";
import { bundledSkillNames } from "@mimirmesh/skills";
import { createFixtureCopy, createSpecifyStub } from "@mimirmesh/testing";
import { executeWorkflowRun, type PresentationProfile } from "@mimirmesh/ui";

import { loadCliContext } from "apps/cli/src/lib/context";
import { createInstallWorkflow } from "apps/cli/src/workflows/install";

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

describe("integration install flow", () => {
	afterEach(() => {
		delete process.env.MIMIRMESH_SPECIFY_BIN;
		delete process.env.MIMIRMESH_PROJECT_ROOT;
	});

	test("initializes fixture repo to installed runtime, report, spec kit, and bundled skill state", async () => {
		const repo = await createFixtureCopy("single-ts", { initializeGit: true });
		try {
			process.env.MIMIRMESH_PROJECT_ROOT = repo;
			process.env.MIMIRMESH_SPECIFY_BIN = await createSpecifyStub(
				join(repo, ".mimirmesh", "testing"),
			);
			const policy = createInstallationPolicy({
				presetId: "recommended",
				mode: "non-interactive",
				selectedAreas: ["core", "skills"],
				explicitAreaOverrides: ["core", "skills"],
				selectedSkills: [bundledSkillNames[0]],
			});

			const finalState = await executeWorkflowRun(createInstallWorkflow({ policy }), presentation);

			expect(["success", "degraded", "failed"]).toContain(finalState.phase);
			expect(await exists(join(repo, ".mimirmesh", "runtime", "docker-compose.yml"))).toBe(true);
			expect(await exists(join(repo, ".mimirmesh", "runtime", "routing-table.json"))).toBe(true);
			expect(await exists(join(repo, ".mimirmesh", "runtime", "bootstrap-state.json"))).toBe(true);
			expect(await exists(join(repo, ".mimirmesh", "reports", "project-summary.md"))).toBe(true);
			expect(await exists(join(repo, ".specify", "scripts", "bash", "common.sh"))).toBe(true);
			expect(await exists(join(repo, ".agents", "skills", bundledSkillNames[0], "SKILL.md"))).toBe(
				true,
			);
		} finally {
			const context = await loadCliContext(repo);
			await runtimeStop(repo, context.config, context.logger);
			await rm(repo, { recursive: true, force: true });
		}
	}, 360_000);
});
