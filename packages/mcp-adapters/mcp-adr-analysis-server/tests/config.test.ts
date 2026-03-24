import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultConfig } from "@mimirmesh/config";

import { translateAdrConfig } from "../src/config";

describe("adr-analysis config translation", () => {
	const tempRoots: string[] = [];

	afterEach(async () => {
		await Promise.all(
			tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
		);
	});

	test("prefers docs/adr when present and supports prompt-only mode without OPENROUTER", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-adr-config-"));
		tempRoots.push(projectRoot);
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

	test("defaults new repositories to docs/adr when no ADR directories exist", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-adr-config-empty-"));
		tempRoots.push(projectRoot);

		const config = createDefaultConfig(projectRoot);
		const translated = translateAdrConfig(projectRoot, config);

		expect(translated.contract.env.ADR_DIRECTORY).toBe("docs/adr");
	});

	test("tolerates legacy docs/decisions in external repositories", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-adr-config-legacy-"));
		tempRoots.push(projectRoot);
		await mkdir(join(projectRoot, "docs", "decisions"), { recursive: true });
		await writeFile(join(projectRoot, "docs", "decisions", "0001-test.md"), "# ADR\n");

		const config = createDefaultConfig(projectRoot);
		const translated = translateAdrConfig(projectRoot, config);

		expect(translated.contract.env.ADR_DIRECTORY).toBe("docs/decisions");
	});
});
