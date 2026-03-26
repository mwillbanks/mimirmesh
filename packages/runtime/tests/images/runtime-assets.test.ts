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

	test("llama.cpp Dockerfile wraps the official image with a reproducible runtime layer", async () => {
		const dockerfile = await readFile(join(runtimeAssetsRoot, "llama-cpp", "Dockerfile"), "utf8");

		expect(dockerfile).toContain("ARG LLAMA_CPP_BASE_IMAGE=ghcr.io/ggml-org/llama.cpp:full");
		expect(dockerfile).toContain("FROM ${LLAMA_CPP_BASE_IMAGE}");
		expect(dockerfile).toContain("apt-get install -y --no-install-recommends curl ca-certificates");
		expect(dockerfile).toContain("apk add --no-cache curl ca-certificates");
	});
});
