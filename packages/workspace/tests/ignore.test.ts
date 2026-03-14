import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createFixtureCopy } from "@mimirmesh/testing";

import { loadRepositoryIgnoreMatcher, searchInRepository } from "../src";

describe("repository ignore matching", () => {
	test("respects .gitignore and .mimirmeshignore for repository searches", async () => {
		const repo = await createFixtureCopy("single-ts");
		await mkdir(join(repo, ".mimirmesh", "backups"), { recursive: true });
		await writeFile(join(repo, ".gitignore"), ".mimirmesh/\nignored.log\n", "utf8");
		await writeFile(join(repo, ".mimirmeshignore"), "notes.tmp\n", "utf8");
		await writeFile(join(repo, ".mimirmesh", "backups", "trace.md"), "noisy needle\n", "utf8");
		await writeFile(join(repo, "ignored.log"), "noisy needle\n", "utf8");
		await writeFile(join(repo, "notes.tmp"), "noisy needle\n", "utf8");
		await writeFile(join(repo, "README.md"), "clean needle\n", "utf8");

		const matcher = await loadRepositoryIgnoreMatcher(repo);
		expect(matcher.ignores(".mimirmesh/backups/trace.md")).toBe(true);
		expect(matcher.ignores("ignored.log")).toBe(true);
		expect(matcher.ignores("notes.tmp")).toBe(true);
		expect(matcher.ignores("README.md")).toBe(false);

		const noisyHits = await searchInRepository(repo, "noisy needle");
		const cleanHits = await searchInRepository(repo, "clean needle", { docsOnly: true });

		expect(noisyHits).toHaveLength(0);
		expect(cleanHits).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					filePath: "README.md",
				}),
			]),
		);
	});
});
