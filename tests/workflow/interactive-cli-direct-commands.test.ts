import { beforeAll, describe, expect, test } from "bun:test";
import { readFile, rm } from "node:fs/promises";
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

		try {
			const init = await run([distBinary, "init", "--non-interactive"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
				MIMIRMESH_SPECIFY_BIN: specifyStub,
				MIMIRMESH_REDUCED_MOTION: "1",
			});
			expect(init.code).toBe(0);
			expect(init.stdout).toContain("Initialize MímirMesh");
			expect(init.stdout).toContain("Workflow progress");
			expect(init.stdout).toContain("Terminal outcome");
			expect(
				init.stdout.includes("[SUCCESS]") ||
					init.stdout.includes("[DEGRADED]") ||
					init.stdout.includes("[FAILED]"),
			).toBe(true);
			expect(await readFile(join(repo, ".mimirmesh", "config.yml"), "utf8")).not.toContain(
				"codebase-memory-mcp",
			);

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
			await run([distBinary, "runtime", "stop", "--non-interactive"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
			});
			await rm(repo, { recursive: true, force: true });
		}
	}, 240_000);
});
