import { beforeAll, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { createRuntimeUpgradeFixture } from "@mimirmesh/testing";

import { run } from "../_helpers/repo";

const root = process.cwd();
const distBinary = join(root, "dist", "mimirmesh");

describe("workflow project runtime repair", () => {
	beforeAll(async () => {
		const build = await run(["bun", "run", "build"], root);
		expect(build.code).toBe(0);
	}, 180_000);

	test("repairs resumable runtime state", async () => {
		const fixture = await createRuntimeUpgradeFixture("repairable");
		try {
			const repair = await run(
				[distBinary, "runtime", "upgrade", "repair", "--non-interactive", "--json"],
				fixture.repo,
				{
					MIMIRMESH_PROJECT_ROOT: fixture.repo,
				},
			);
			expect(repair.code).toBe(0);
			expect(
				repair.stdout.includes('"kind": "success"') || repair.stdout.includes('"kind": "degraded"'),
			).toBe(true);
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	}, 180_000);
});
