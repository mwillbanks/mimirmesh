import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createDefaultConfig } from "@mimirmesh/config";

import { translateAdrConfig } from "../src/config";

describe("adr-analysis config translation", () => {
	test("prefers docs/adr when present and supports prompt-only mode without OPENROUTER", async () => {
		const projectRoot = "/tmp/adr";
		await mkdir(join(projectRoot, "docs", "adr"), { recursive: true });
		await mkdir(join(projectRoot, "docs", "decisions"), { recursive: true });
		await mkdir(join(projectRoot, "docs", "adrs"), { recursive: true });
		await writeFile(join(projectRoot, "docs", "adr", "0001-test.md"), "# ADR\n");
		const config = createDefaultConfig(projectRoot);
		const translated = translateAdrConfig(projectRoot, config);

		expect(translated.contract.env.PROJECT_PATH).toBe("/workspace");
		expect(translated.contract.env.ADR_DIRECTORY).toBe("docs/adr");
		expect(translated.degraded).toBe(false);
	});

	test("falls back to legacy docs/decisions when canonical ADRs are absent", async () => {
		const projectRoot = "/tmp/adr-legacy";
		await mkdir(join(projectRoot, "docs", "decisions"), { recursive: true });
		await writeFile(join(projectRoot, "docs", "decisions", "0001-test.md"), "# ADR\n");

		const config = createDefaultConfig(projectRoot);
		const translated = translateAdrConfig(projectRoot, config);

		expect(translated.contract.env.ADR_DIRECTORY).toBe("docs/decisions");
	});
});
