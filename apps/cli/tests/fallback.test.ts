import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveCliVersion } from "../src/fallback";

describe("resolveCliVersion", () => {
	test("prefers the installed manifest beside the compiled binary", async () => {
		const installDir = await mkdtemp(join(tmpdir(), "mimirmesh-cli-version-"));
		const execPath = join(installDir, "mimirmesh");

		await writeFile(execPath, "");
		await writeFile(
			join(installDir, "manifest.json"),
			`${JSON.stringify({ version: "9.8.7" }, null, 2)}\n`,
			"utf8",
		);

		expect(await resolveCliVersion(execPath)).toBe("9.8.7");
	});

	test("falls back to the repository package version when no installed manifest exists", async () => {
		const installDir = await mkdtemp(join(tmpdir(), "mimirmesh-cli-version-source-"));
		const execPath = join(installDir, "mimirmesh");
		const packageJson = (await Bun.file(
			new URL("../../../package.json", import.meta.url),
		).json()) as {
			version?: string;
		};

		await writeFile(execPath, "");

		expect(await resolveCliVersion(execPath)).toBe(packageJson.version ?? "1.0.0");
	});
});
