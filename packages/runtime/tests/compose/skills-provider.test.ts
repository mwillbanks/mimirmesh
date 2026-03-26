import { describe, expect, test } from "bun:test";

import { createDefaultConfig } from "@mimirmesh/config";

import { resolveSkillProviderSelection } from "../../src";

describe("skill provider selection", () => {
	test("chooses the local llama.cpp CPU image when GPUs are unavailable", () => {
		const repo = "/tmp/mimirmesh-skill-provider";
		const config = createDefaultConfig(repo);
		config.skills.embeddings.enabled = true;
		config.skills.embeddings.providers = [
			{
				type: "llama_cpp",
				model: "Qwen/Qwen3-Embedding-0.6B-GGUF",
				baseUrl: "http://localhost:8012/v1",
				timeoutMs: 30_000,
				maxRetries: 2,
			},
		];

		const selection = resolveSkillProviderSelection(repo, config, { hostGpuAvailable: false });

		expect(selection).toMatchObject({
			enabled: true,
			readiness: "ready",
			selectedProviderIndex: 0,
			selectedProviderType: "llama_cpp",
		});
		expect(selection.localRuntime).toMatchObject({
			serviceName: "mm-llama-cpp",
			image: "mimirmesh/mm-llama-cpp:local-cpu",
			baseImage: "ghcr.io/ggml-org/llama.cpp:full",
			variant: "server",
			dockerfile: "/tmp/mimirmesh-skill-provider/.mimirmesh/runtime/images/llama-cpp/Dockerfile",
			port: 8012,
		});
	});

	test("switches to the local llama.cpp GPU image when GPUs are available", () => {
		const repo = "/tmp/mimirmesh-skill-provider-gpu";
		const config = createDefaultConfig(repo);
		config.skills.embeddings.enabled = true;
		config.skills.embeddings.providers = [
			{
				type: "llama_cpp",
				model: "Qwen/Qwen3-Embedding-0.6B-GGUF",
				baseUrl: "http://localhost:8012/v1",
				timeoutMs: 30_000,
				maxRetries: 2,
			},
		];

		const selection = resolveSkillProviderSelection(repo, config, { hostGpuAvailable: true });

		expect(selection.localRuntime).toMatchObject({
			image: "mimirmesh/mm-llama-cpp:local-cuda",
			baseImage: "ghcr.io/ggml-org/llama.cpp:server-cuda",
			variant: "server-cuda",
		});
	});
});
