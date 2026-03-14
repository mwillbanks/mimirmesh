import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const runtimeAssetsRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
	"..",
	"docker",
	"images",
);

describe("runtime image assets", () => {
	test("ADR analysis Dockerfile uses packages available on the Bun slim base image", async () => {
		const dockerfile = await readFile(
			join(runtimeAssetsRoot, "adr-analysis", "Dockerfile"),
			"utf8",
		);

		expect(dockerfile).toContain("python3-setuptools");
		expect(dockerfile).not.toContain("python3-distutils");
	});
});
