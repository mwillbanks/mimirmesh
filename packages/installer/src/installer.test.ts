import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { installFromArtifacts } from "./index";

describe("installer", () => {
	test("installs binaries from artifact directory", async () => {
		const artifactDir = await mkdtemp(join(tmpdir(), "mimirmesh-artifacts-"));
		const targetDir = await mkdtemp(join(tmpdir(), "mimirmesh-bin-"));

		await mkdir(artifactDir, { recursive: true });
		const binary = join(artifactDir, "mimirmesh");
		await writeFile(binary, "#!/usr/bin/env bash\necho ok\n", { mode: 0o755 });
		await mkdir(join(artifactDir, "mimirmesh-assets", "docker", "images", "common"), {
			recursive: true,
		});
		await writeFile(
			join(artifactDir, "mimirmesh-assets", "docker", "images", "common", "engine-bridge.mjs"),
			"console.log('bridge');\n",
		);

		const result = await installFromArtifacts({ artifactDir, targetBinDir: targetDir });

		expect(result.verified).toBe(true);
		expect(await Bun.file(result.binaryPath).exists()).toBe(true);
		expect(await Bun.file(result.aliasPath).exists()).toBe(true);
		expect(
			await Bun.file(
				join(targetDir, "mimirmesh-assets", "docker", "images", "common", "engine-bridge.mjs"),
			).exists(),
		).toBe(true);
	});
});
