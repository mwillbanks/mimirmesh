import { describe, expect, test } from "bun:test";
import { lstat, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	type BundledSkillsRootResolutionOptions,
	bundledSkillsInstallDir,
	installBundledSkills,
	listInstalledBundledSkills,
	removeBundledSkills,
	resolveBundledSkillsRoot,
	updateBundledSkills,
} from "../src";

describe("bundled skill installation", () => {
	test("installs bundled skills as symbolic links when requested", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-skills-install-link-"));

		const result = await installBundledSkills({
			projectRoot: repo,
			names: ["mimirmesh-agent-router"],
			mode: "symlink",
		});

		expect(result.installed).toEqual(["mimirmesh-agent-router"]);
		const target = join(bundledSkillsInstallDir(repo), "mimirmesh-agent-router");
		expect((await lstat(target)).isSymbolicLink()).toBe(true);
	});

	test("installs bundled skills as copied directories and detects drift", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-skills-install-copy-"));

		await installBundledSkills({
			projectRoot: repo,
			names: ["mimirmesh-code-navigation"],
			mode: "copy",
		});

		const target = join(bundledSkillsInstallDir(repo), "mimirmesh-code-navigation", "SKILL.md");
		await writeFile(target, `${await readFile(target, "utf8")}\nDrifted copy.\n`, "utf8");

		const statuses = await listInstalledBundledSkills(repo);
		const installed = statuses.find((status) => status.name === "mimirmesh-code-navigation");
		expect(installed?.installed).toBe(true);
		expect(installed?.mode).toBe("copy");
		expect(installed?.outdated).toBe(true);
	});

	test("updates outdated copied skills and removes installed skills", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-skills-update-"));
		await mkdir(join(repo, ".agents"), { recursive: true });

		await installBundledSkills({
			projectRoot: repo,
			names: ["mimirmesh-integration-analysis"],
			mode: "copy",
		});

		const target = join(
			bundledSkillsInstallDir(repo),
			"mimirmesh-integration-analysis",
			"SKILL.md",
		);
		await writeFile(target, "broken\n", "utf8");

		const update = await updateBundledSkills({
			projectRoot: repo,
			names: ["mimirmesh-integration-analysis"],
			mode: "copy",
		});
		expect(update.updated).toEqual(["mimirmesh-integration-analysis"]);

		const removal = await removeBundledSkills({
			projectRoot: repo,
			names: ["mimirmesh-integration-analysis"],
		});
		expect(removal.removed).toEqual(["mimirmesh-integration-analysis"]);
	});

	test("prefers installed binary skill assets over source checkout assets when both exist", async () => {
		const sandbox = await mkdtemp(join(tmpdir(), "mimirmesh-skills-root-resolution-"));
		const execDir = join(sandbox, "bin");
		const execSkillsRoot = join(execDir, "mimirmesh-assets", "skills");
		const sourceSkillsRoot = join(sandbox, "source-skills");

		await mkdir(execSkillsRoot, { recursive: true });
		await mkdir(sourceSkillsRoot, { recursive: true });
		await writeFile(join(execSkillsRoot, "catalog.json"), "{}\n", "utf8");
		await writeFile(join(sourceSkillsRoot, "catalog.json"), "{}\n", "utf8");

		const resolutionOptions: BundledSkillsRootResolutionOptions = {
			execPath: join(execDir, "mimirmesh"),
			cwd: sandbox,
			sourceRoot: sourceSkillsRoot,
			sourceCheckoutRoot: join(sandbox, "checkout"),
		};

		expect(resolveBundledSkillsRoot(resolutionOptions)).toBe(execSkillsRoot);
	});
});
