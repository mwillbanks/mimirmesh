import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getGlobalConfigPath, readGlobalConfig, writeGlobalConfig } from "../../src";

describe("global config readers", () => {
	test("creates the default global config when missing", async () => {
		const homeDirectory = await mkdtemp(join(tmpdir(), "mimirmesh-global-config-"));

		const config = await readGlobalConfig({ homeDirectory, createIfMissing: true });
		expect(config.skills.install.symbolic).toBe(true);
		expect(await Bun.file(getGlobalConfigPath(homeDirectory)).exists()).toBe(true);
	});

	test("reads and writes a global config override", async () => {
		const homeDirectory = await mkdtemp(join(tmpdir(), "mimirmesh-global-config-write-"));

		await writeGlobalConfig(
			{
				version: 1,
				skills: {
					install: {
						symbolic: false,
					},
				},
			},
			{ homeDirectory },
		);

		const config = await readGlobalConfig({ homeDirectory, createIfMissing: false });
		expect(config.skills.install.symbolic).toBe(false);

		const raw = await readFile(getGlobalConfigPath(homeDirectory), "utf8");
		expect(raw).toContain("symbolic: false");
	});
});
