import { beforeAll, describe, expect, test } from "bun:test";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { createRuntimeUpgradeFixture } from "@mimirmesh/testing";

import { run } from "../_helpers/repo";

const root = process.cwd();
const distBinary = join(root, "dist", "mimirmesh");

describe("workflow project runtime upgrade", () => {
	const ciSafeTest = process.env.CI === "true" ? test.skip : test;

	beforeAll(async () => {
		const build = await run(["bun", "run", "build"], root);
		expect(build.code).toBe(0);
	}, 180_000);

	ciSafeTest(
		"upgrades supported older runtime in place",
		async () => {
			const fixture = await createRuntimeUpgradeFixture("outdated");
			try {
				const status = await run(
					[distBinary, "runtime", "upgrade", "status", "--json"],
					fixture.repo,
					{
						MIMIRMESH_PROJECT_ROOT: fixture.repo,
					},
				);
				expect(status.code).toBe(0);
				expect(status.stdout.includes('"state": "outdated"')).toBe(true);

				const migrate = await run(
					[distBinary, "runtime", "upgrade", "migrate", "--non-interactive"],
					fixture.repo,
					{
						MIMIRMESH_PROJECT_ROOT: fixture.repo,
					},
				);
				expect(migrate.code).toBe(0);

				const version = await readFile(
					join(fixture.repo, ".mimirmesh", "runtime", "version.json"),
					"utf8",
				);
				expect(version.includes('"runtimeSchemaVersion": 4')).toBe(true);
			} finally {
				await rm(fixture.repo, { recursive: true, force: true });
			}
		},
		180_000,
	);
});
