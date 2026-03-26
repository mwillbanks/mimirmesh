import { beforeAll, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { createFixtureCopy } from "@mimirmesh/testing";

import { run } from "../_helpers/repo";

const root = process.cwd();
const distBinary = join(root, "dist", "mimirmesh");

describe("integration interactive cli entry", () => {
	beforeAll(async () => {
		const build = await run(["bun", "run", "build"], root);
		expect(build.code).toBe(0);
	}, 180_000);

	test("launches the branded dashboard shell in a pseudo-terminal", async () => {
		const repo = await createFixtureCopy("single-ts", { initializeGit: true });
		try {
			const shell = await run(
				[
					"sh",
					"-lc",
					`(sleep 1; printf q; sleep 2; printf q) | script -q /dev/null sh -lc "stty cols 140 rows 40; exec ${distBinary}"`,
				],
				repo,
				{
					MIMIRMESH_PROJECT_ROOT: repo,
					MIMIRMESH_REDUCED_MOTION: "1",
				},
			);

			expect(shell.code).toBe(0);
			expect(shell.stdout).toContain("MIMIRMESH");
			expect(shell.stdout).toContain("Interactive CLI Experience");
			expect(
				shell.stdout.includes("Sections") || shell.stdout.includes("Loading dashboard state"),
			).toBe(true);
			expect(shell.stdout).toContain("Keyboard:");
			expect(shell.stdout).not.toContain("codebase-memory-mcp");
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	}, 120_000);
});
