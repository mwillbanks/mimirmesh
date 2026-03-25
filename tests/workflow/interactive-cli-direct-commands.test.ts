import { beforeAll, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { createFixtureCopy, createSpecifyStub } from "@mimirmesh/testing";

import { run } from "../_helpers/repo";

const root = process.cwd();
const distBinary = join(root, "dist", "mimirmesh");

describe("workflow interactive direct commands", () => {
	beforeAll(async () => {
		const build = await run(["bun", "run", "build"], root);
		expect(build.code).toBe(0);
	}, 180_000);

	test("renders step-based progress and terminal outcomes for human-facing direct commands", async () => {
		const repo = await createFixtureCopy("single-ts", { initializeGit: true });
		const specifyStub = await createSpecifyStub(join(repo, ".mimirmesh", "testing"));
		const originalProjectRoot = process.env.MIMIRMESH_PROJECT_ROOT;
		const originalSpecifyBin = process.env.MIMIRMESH_SPECIFY_BIN;

		try {
			const installIde = await run(
				[distBinary, "install", "ide", "--non-interactive", "--target", "vscode"],
				repo,
				{
					MIMIRMESH_PROJECT_ROOT: repo,
					MIMIRMESH_SPECIFY_BIN: specifyStub,
					MIMIRMESH_REDUCED_MOTION: "1",
				},
			);
			expect(installIde.code).toBe(0);
			expect(installIde.stdout).toContain("Install IDE Integration");
			expect(installIde.stdout).toContain("Workflow progress");
			expect(installIde.stdout).toContain("Terminal outcome");
			expect(
				installIde.stdout.includes("[SUCCESS]") ||
					installIde.stdout.includes("[DEGRADED]") ||
					installIde.stdout.includes("[FAILED]"),
			).toBe(true);
			expect(await readFile(join(repo, ".vscode", "mcp.json"), "utf8")).toContain("mimirmesh");

			const runtimeStatus = await run([distBinary, "runtime", "status"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
				MIMIRMESH_REDUCED_MOTION: "1",
			});
			expect(runtimeStatus.code).toBe(0);
			expect(runtimeStatus.stdout).toContain("Inspect Runtime Status");
			expect(runtimeStatus.stdout).toContain("Workflow progress");
			expect(runtimeStatus.stdout).toContain("Terminal outcome");

			const runtimeStatusJson = await run([distBinary, "runtime", "status", "--json"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
				MIMIRMESH_REDUCED_MOTION: "1",
			});
			expect(runtimeStatusJson.code).toBe(0);
			const payload = JSON.parse(runtimeStatusJson.stdout) as {
				workflowId: string;
				outcome: { kind: string } | null;
			};
			expect(payload.workflowId).toBe("runtime-status");
			expect(payload.outcome).not.toBeNull();
		} finally {
			if (originalProjectRoot === undefined) {
				delete process.env.MIMIRMESH_PROJECT_ROOT;
			} else {
				process.env.MIMIRMESH_PROJECT_ROOT = originalProjectRoot;
			}
			if (originalSpecifyBin === undefined) {
				delete process.env.MIMIRMESH_SPECIFY_BIN;
			} else {
				process.env.MIMIRMESH_SPECIFY_BIN = originalSpecifyBin;
			}
			await run([distBinary, "runtime", "stop", "--non-interactive"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
			});
			await rm(repo, { recursive: true, force: true });
		}
	}, 240_000);

	test("promotes install as the only primary onboarding command in help output", async () => {
		const help = await run([distBinary, "--help"], root);

		expect(help.code).toBe(0);
		expect(help.stdout).toContain("mimirmesh install");
		expect(help.stdout).not.toContain("mimirmesh init");
		expect(help.stdout).not.toContain("mimirmesh setup");
	});

	test("prints install-specific flags for automation-safe help output", async () => {
		const help = await run([distBinary, "install", "--help"], root);

		expect(help.code).toBe(0);
		expect(help.stdout).toContain("Usage: mimirmesh install [flags]");
		expect(help.stdout).toContain("--preset <minimal|recommended|full>");
		expect(help.stdout).toContain("--areas <core,ide,skills>");
		expect(help.stdout).toContain("--ide <target[,target]>");
		expect(help.stdout).toContain("--skills <all|name[,name]>");
		expect(help.stdout).toContain("--yes");
		expect(help.stdout).toContain("--non-interactive");
		expect(help.stdout).toContain("--json");
		expect(help.stdout).toContain("mimirmesh install --non-interactive --preset recommended");
	});

	test("prints subcommand-specific help for install ide", async () => {
		const help = await run([distBinary, "install", "ide", "--help"], root);

		expect(help.code).toBe(0);
		expect(help.stdout).toContain("Usage: mimirmesh install ide [flags]");
		expect(help.stdout).toContain("--target <vscode|cursor|claude|codex>");
		expect(help.stdout).toContain("--server-command <command>");
		expect(help.stdout).toContain("--non-interactive");
		expect(help.stdout).toContain("--json");
	});

	test("allows first-run non-interactive install and requires --yes on rerun updates", async () => {
		const repo = await createFixtureCopy("single-ts", { initializeGit: true });
		const specifyStub = await createSpecifyStub(join(repo, ".mimirmesh", "testing"));
		const installArgs = [
			distBinary,
			"install",
			"--preset",
			"full",
			"--ide",
			"vscode,cursor",
			"--skills",
			"all",
			"--non-interactive",
			"--json",
		];
		const originalProjectRoot = process.env.MIMIRMESH_PROJECT_ROOT;
		const originalSpecifyBin = process.env.MIMIRMESH_SPECIFY_BIN;

		try {
			await Promise.all([
				mkdir(join(repo, "docs", "architecture"), { recursive: true }),
				mkdir(join(repo, "docs", "features"), { recursive: true }),
				mkdir(join(repo, "docs", "runbooks"), { recursive: true }),
				mkdir(join(repo, "docs", "specifications"), { recursive: true }),
				mkdir(join(repo, "docs", "adr"), { recursive: true }),
			]);

			const env = {
				MIMIRMESH_PROJECT_ROOT: repo,
				MIMIRMESH_SPECIFY_BIN: specifyStub,
				MIMIRMESH_REDUCED_MOTION: "1",
			};

			const firstInstall = await run(installArgs, repo, env);
			expect(firstInstall.code).toBe(0);
			const firstPayload = JSON.parse(firstInstall.stdout) as {
				outcome: { kind: string; message: string } | null;
			};
			expect(["success", "degraded"]).toContain(firstPayload.outcome?.kind ?? "");
			expect(await readFile(join(repo, ".vscode", "mcp.json"), "utf8")).toContain("mimirmesh");
			expect(await readFile(join(repo, ".cursor", "mcp.json"), "utf8")).toContain("mimirmesh");

			const blockedRerun = await run(installArgs, repo, env);
			expect(blockedRerun.code).toBe(0);
			const blockedPayload = JSON.parse(blockedRerun.stdout) as {
				outcome: { kind: string; message: string } | null;
			};
			expect(blockedPayload.outcome?.kind).toBe("failed");
			expect(blockedPayload.outcome?.message ?? "").toContain(
				"cannot overwrite existing install-managed files",
			);

			const confirmedRerun = await run([...installArgs.slice(0, -1), "--yes", "--json"], repo, env);
			expect(confirmedRerun.code).toBe(0);
			const confirmedPayload = JSON.parse(confirmedRerun.stdout) as {
				outcome: { kind: string } | null;
			};
			expect(["success", "degraded"]).toContain(confirmedPayload.outcome?.kind ?? "");
		} finally {
			if (originalProjectRoot === undefined) {
				delete process.env.MIMIRMESH_PROJECT_ROOT;
			} else {
				process.env.MIMIRMESH_PROJECT_ROOT = originalProjectRoot;
			}
			if (originalSpecifyBin === undefined) {
				delete process.env.MIMIRMESH_SPECIFY_BIN;
			} else {
				process.env.MIMIRMESH_SPECIFY_BIN = originalSpecifyBin;
			}
			await run([distBinary, "runtime", "stop", "--non-interactive"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
			});
			await rm(repo, { recursive: true, force: true });
		}
	}, 240_000);
});
