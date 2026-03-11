import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { materializeRuntimeImages } from "./materialize";

describe("materializeRuntimeImages", () => {
	test("loads runtime assets from the bundled asset directory override", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-materialize-project-"));
		const assetsRoot = await mkdtemp(join(tmpdir(), "mimirmesh-materialize-assets-"));
		const previousOverride = process.env.MIMIRMESH_RUNTIME_ASSETS_DIR;

		try {
			const assetFiles = [
				["common", "engine-bridge.mjs", "console.log('bridge');\n"],
				["srclight", "Dockerfile", "FROM scratch\n"],
				["document-mcp", "Dockerfile", "FROM scratch\n"],
				["adr-analysis", "Dockerfile", "FROM scratch\n"],
				["codebase-memory", "Dockerfile", "FROM scratch\n"],
			] as const;

			for (const [directory, fileName, content] of assetFiles) {
				await mkdir(join(assetsRoot, directory), { recursive: true });
				await writeFile(join(assetsRoot, directory, fileName), content, "utf8");
			}

			process.env.MIMIRMESH_RUNTIME_ASSETS_DIR = assetsRoot;

			const materialized = await materializeRuntimeImages(projectRoot);
			expect(materialized.files.length).toBe(assetFiles.length);
			expect(
				await readFile(
					join(projectRoot, ".mimirmesh", "runtime", "images", "srclight", "Dockerfile"),
					"utf8",
				),
			).toBe("FROM scratch\n");
		} finally {
			if (previousOverride === undefined) {
				delete process.env.MIMIRMESH_RUNTIME_ASSETS_DIR;
			} else {
				process.env.MIMIRMESH_RUNTIME_ASSETS_DIR = previousOverride;
			}
			await rm(projectRoot, { recursive: true, force: true });
			await rm(assetsRoot, { recursive: true, force: true });
		}
	});
});
