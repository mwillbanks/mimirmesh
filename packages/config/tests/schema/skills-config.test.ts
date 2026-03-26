import { describe, expect, test } from "bun:test";

import { createDefaultConfig } from "../../src/defaults";
import { validateConfigValue } from "../../src/schema";

describe("skills config schema", () => {
	test("creates and validates the default skills policy", () => {
		const result = validateConfigValue(createDefaultConfig("/repo"));

		expect(result.ok).toBe(true);
		expect(result.config?.skills).toMatchObject({
			alwaysLoad: [],
			resolve: {
				precedence: [
					"alwaysLoad",
					"explicitName",
					"aliasOrTrigger",
					"lexical",
					"embeddings",
					"mcpEngineContext",
				],
				limit: 10,
			},
			read: {
				defaultMode: "memory",
				progressiveDisclosure: "strict",
			},
			cache: {
				negativeCache: {
					enabled: true,
					ttlSeconds: 900,
				},
			},
			compression: {
				enabled: true,
				algorithm: "zstd",
				fallbackAlgorithm: "gzip",
				profile: "strict",
			},
			embeddings: {
				enabled: false,
				fallbackOnFailure: true,
				providers: [],
			},
		});
	});

	test("accepts enabled embeddings when at least one provider is configured", () => {
		const config = createDefaultConfig("/repo");
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
		const result = validateConfigValue(config);

		expect(result.ok).toBe(true);
		expect(result.config?.skills.embeddings.enabled).toBe(true);
		expect(result.config?.skills.embeddings.providers).toHaveLength(1);
	});

	test("requires api keys for OpenAI-backed providers", () => {
		const openAiConfig = createDefaultConfig("/repo");
		openAiConfig.skills.embeddings.enabled = true;
		openAiConfig.skills.embeddings.providers = [
			{
				type: "openai",
				model: "text-embedding-3-small",
				baseUrl: "https://api.openai.com/v1",
				timeoutMs: 30_000,
				maxRetries: 2,
			},
		];
		const remoteConfig = createDefaultConfig("/repo");
		remoteConfig.skills.embeddings.enabled = true;
		remoteConfig.skills.embeddings.providers = [
			{
				type: "openai_compatible_remote",
				model: "text-embedding-model",
				baseUrl: "https://example.invalid/v1",
				timeoutMs: 30_000,
				maxRetries: 2,
			},
		];

		expect(validateConfigValue(openAiConfig).ok).toBe(false);
		expect(validateConfigValue(remoteConfig).ok).toBe(false);
	});
});
