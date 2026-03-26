import { afterEach, describe, expect, test } from "bun:test";
import { access, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { createInstallationPolicy } from "@mimirmesh/installer";
import { runtimeStop } from "@mimirmesh/runtime";
import { bundledSkillNames } from "@mimirmesh/skills";
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

const exists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

describe("install workflow", () => {
	const originalProjectRoot = process.env.MIMIRMESH_PROJECT_ROOT;
	const originalSpecify = process.env.MIMIRMESH_SPECIFY_BIN;
	const ciSafeTest = process.env.CI === "true" ? test.skip : test;

	afterEach(() => {
		process.env.MIMIRMESH_PROJECT_ROOT = originalProjectRoot;
		process.env.MIMIRMESH_SPECIFY_BIN = originalSpecify;
	});

	ciSafeTest(
		"installs core repository state and selected bundled skills from one workflow",
		async () => {
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

				const finalState = await executeWorkflowRun(
					createInstallWorkflow({ policy }),
					presentation,
				);

				expect(["success", "degraded", "failed"]).toContain(finalState.phase);
				expect(
					["completed", "degraded"].includes(
						finalState.steps.find((step) => step.id === "execute-core")?.status ?? "",
					),
				).toBe(true);
				expect(await exists(join(repo, ".mimirmesh", "config.yml"))).toBe(true);
				expect(await exists(join(repo, ".mimirmesh", "reports", "project-summary.md"))).toBe(true);
				expect(await exists(join(repo, ".specify", "scripts", "bash", "common.sh"))).toBe(true);
				expect(await exists(join(repo, "AGENTS.md"))).toBe(true);
				expect(await exists(join(repo, ".mimirmesh", "runtime", "skills-registry.json"))).toBe(
					true,
				);
				expect(
					await exists(join(repo, ".agents", "skills", bundledSkillNames[0], "SKILL.md")),
				).toBe(true);
				expect(await readFile(join(repo, ".mimirmesh", "config.yml"), "utf8")).toContain("skills:");
				expect(await readFile(join(repo, ".mimirmesh", "config.yml"), "utf8")).toContain(
					"type: llama_cpp",
				);
				expect(await readFile(join(repo, "AGENTS.md"), "utf8")).toContain(
					"BEGIN MIMIRMESH SKILLS SECTION",
				);
				expect(finalState.outcome?.evidence?.some((row) => row.label === "Selected preset")).toBe(
					true,
				);
				expect(finalState.outcome?.machineReadablePayload).toMatchObject({
					embeddings: {
						mode: "docker-llama-cpp",
					},
					skillsMaintenance: {
						guidanceOutcome: expect.any(String),
						registryReadiness: expect.any(String),
					},
				});
			} finally {
				const context = await loadCliContext(repo);
				await runtimeStop(repo, context.config, context.logger);
				await rm(repo, { recursive: true, force: true });
			}
		},
		180_000,
	);
});
