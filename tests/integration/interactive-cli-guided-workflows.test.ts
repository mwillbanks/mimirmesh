import { beforeAll, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { createRuntimeUpgradeFixture } from "@mimirmesh/testing";

import { run } from "../_helpers/repo";

const root = process.cwd();
const distBinary = join(root, "dist", "mimirmesh");

describe("integration guided cli workflows", () => {
	beforeAll(async () => {
		const build = await run(["bun", "run", "build"], root);
		expect(build.code).toBe(0);
	}, 180_000);

	test("rejects mutating workflows in non-interactive terminals unless the automation-safe flag is explicit", async () => {
		const fixture = await createRuntimeUpgradeFixture("repairable");
		try {
			const blockedRepair = await run([distBinary, "runtime", "upgrade", "repair"], fixture.repo, {
				MIMIRMESH_PROJECT_ROOT: fixture.repo,
				MIMIRMESH_REDUCED_MOTION: "1",
			});
			expect(blockedRepair.code).toBe(0);
			expect(blockedRepair.stdout).toContain("Terminal outcome");
			expect(blockedRepair.stdout).toContain(
				"This workflow needs guidance in an interactive terminal.",
			);
			expect(blockedRepair.stdout).toContain("--non-interactive");

			const repair = await run(
				[distBinary, "runtime", "upgrade", "repair", "--non-interactive", "--json"],
				fixture.repo,
				{
					MIMIRMESH_PROJECT_ROOT: fixture.repo,
					MIMIRMESH_REDUCED_MOTION: "1",
				},
			);
			expect(repair.code).toBe(0);
			const repairPayload = JSON.parse(repair.stdout) as {
				outcome: { kind: string; message: string } | null;
			};
			expect(repairPayload.outcome).not.toBeNull();
			expect(["success", "degraded", "failed"]).toContain(repairPayload.outcome?.kind ?? "");

			const missingInstallChoices = await run(
				[distBinary, "install", "--non-interactive"],
				fixture.repo,
				{
					MIMIRMESH_PROJECT_ROOT: fixture.repo,
					MIMIRMESH_REDUCED_MOTION: "1",
				},
			);
			expect(missingInstallChoices.code).toBe(0);
			expect(missingInstallChoices.stdout).toContain(
				"Install requires a preset or explicit install-area selections.",
			);

			const missingTarget = await run(
				[distBinary, "install", "ide", "--non-interactive"],
				fixture.repo,
				{
					MIMIRMESH_PROJECT_ROOT: fixture.repo,
					MIMIRMESH_REDUCED_MOTION: "1",
				},
			);
			expect(missingTarget.code).toBe(0);
			expect(missingTarget.stdout).toContain(
				"An explicit IDE target is required in non-interactive mode.",
			);
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	}, 180_000);
});
