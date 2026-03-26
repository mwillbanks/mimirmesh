import { describe, expect, test } from "bun:test";

import {
	buildInstallChangeSummary,
	createInstallationPolicy,
	createInstallationStateSnapshot,
	createSkillInstallConfig,
	createSkillProviderDefaults,
	defaultLmStudioBaseUrl,
	defaultLmStudioModel,
	type InstallationPolicy,
	type InstallTarget,
	mergeSkillInstallConfig,
	resolveEmbeddingsInstallConfig,
	resolveInstallAreas,
	validateInstallationPolicy,
} from "../src/index";

describe("installer policy helpers", () => {
	test("always retains the required core area", () => {
		expect(resolveInstallAreas("minimal")).toEqual(["core"]);
		expect(
			createInstallationPolicy({
				mode: "interactive",
				selectedAreas: ["skills"],
			}).selectedAreas,
		).toEqual(["core", "skills"]);
	});

	test("requires explicit non-interactive intent and IDE target when needed", () => {
		expect(
			validateInstallationPolicy({
				mode: "non-interactive",
				selectedAreas: ["core"],
				explicitAreaOverrides: [],
				ideTargets: [],
				selectedSkills: [],
				embeddings: resolveEmbeddingsInstallConfig({
					selectedAreas: ["core"],
				}),
			} satisfies InstallationPolicy),
		).toEqual({
			ok: false,
			errors: [
				"Non-interactive install requires an explicit preset or explicit install-area selections.",
			],
		});

		expect(
			validateInstallationPolicy(
				createInstallationPolicy({
					mode: "non-interactive",
					presetId: "full",
					selectedAreas: ["core", "ide"],
					explicitAreaOverrides: ["core", "ide"],
					ideTargets: [],
				}),
			),
		).toEqual({
			ok: false,
			errors: [
				"Non-interactive install requires `--ide <target[,target]>` when IDE integration is selected.",
			],
		});

		expect(
			validateInstallationPolicy(
				createInstallationPolicy({
					mode: "non-interactive",
					presetId: "full",
					selectedAreas: ["core", "ide"],
					explicitAreaOverrides: ["core", "ide"],
					ideTargets: ["vscode", "cursor"] satisfies InstallTarget[],
				}),
			),
		).toEqual({ ok: true, errors: [] });
	});

	test("builds reproducible install change summaries from policy and snapshot", () => {
		const policy = createInstallationPolicy({
			mode: "interactive",
			presetId: "recommended",
			selectedAreas: ["core", "skills"],
			explicitAreaOverrides: ["core", "skills"],
			selectedSkills: ["mimirmesh-agent-router"],
		});
		const snapshot = createInstallationStateSnapshot({
			projectRoot: "/repo",
			completedAreas: ["skills"],
			degradedAreas: ["core"],
			pendingAreas: [],
			detectedArtifacts: [
				{
					areaId: "core",
					path: "/repo/.mimirmesh/runtime/bootstrap-state.json",
					status: "present",
					requiresConfirmation: true,
				},
				{
					areaId: "skills",
					path: "/repo/.agents/skills/mimirmesh-agent-router/SKILL.md",
					status: "missing",
					requiresConfirmation: true,
				},
				{
					areaId: "ide",
					path: "/repo/.vscode/mcp.json",
					status: "missing",
					requiresConfirmation: true,
				},
			],
			specKitStatus: {
				ready: false,
				details: "Spec Kit bootstrap still required.",
			},
			runtimeStatus: {
				state: "degraded",
				message: "Runtime needs attention.",
				reasons: ["Start Docker daemon."],
			},
		});

		expect(buildInstallChangeSummary(policy, snapshot)).toEqual({
			createdFiles: ["/repo/.agents/skills/mimirmesh-agent-router/SKILL.md"],
			updatedFiles: ["/repo/.mimirmesh/runtime/bootstrap-state.json"],
			skippedAreas: ["ide"],
			appliedAreas: ["core", "skills"],
			warnings: [
				"Start Docker daemon.",
				"Embeddings strategy: Docker-managed llama.cpp (Qwen/Qwen3-Embedding-0.6B-GGUF via http://localhost:8012/v1).",
			],
		});
	});

	test("defaults skills config and provider order by install preset", () => {
		const minimal = createSkillInstallConfig({ presetId: "minimal" });
		expect(minimal.embeddings.enabled).toBe(false);
		expect(minimal.alwaysLoad).toEqual([]);
		expect(minimal.embeddings.providers).toEqual([]);

		const recommended = createSkillInstallConfig({
			presetId: "recommended",
			skillProviderDefaults: {
				localBaseUrl: "http://localhost:8012/v1",
				localModel: "Qwen/Qwen3-Embedding-0.6B-GGUF",
			},
		});
		expect(recommended.alwaysLoad).toEqual(["mimirmesh-agent-router"]);
		expect(recommended.embeddings.enabled).toBe(true);
		expect(recommended.embeddings.providers[0]).toMatchObject({
			type: "llama_cpp",
			model: "Qwen/Qwen3-Embedding-0.6B-GGUF",
			baseUrl: "http://localhost:8012/v1",
		});
	});

	test("supports explicit installer embeddings strategies without forcing docker-managed llama.cpp", () => {
		const config = createSkillInstallConfig({
			presetId: "recommended",
			selectedAreas: ["core", "skills"],
			embeddings: {
				mode: "existing-lm-studio",
				baseUrl: defaultLmStudioBaseUrl,
				model: defaultLmStudioModel,
				apiKey: "lm-token",
				fallbackOnFailure: true,
			},
		});

		expect(config.embeddings).toEqual({
			enabled: true,
			fallbackOnFailure: true,
			providers: [
				{
					type: "lm_studio",
					model: defaultLmStudioModel,
					baseUrl: defaultLmStudioBaseUrl,
					apiKey: "lm-token",
					timeoutMs: 30_000,
					maxRetries: 2,
				},
			],
		});
	});

	test("keeps provider fallback ordering deterministic", () => {
		const providers = createSkillProviderDefaults({
			localBaseUrl: "http://localhost:8012/v1",
			remoteFallbackProviders: [
				{
					type: "openai_compatible_remote",
					model: "remote-embedding-model",
					baseUrl: "https://example.invalid/v1",
					apiKey: "secret",
					timeoutMs: 30_000,
					maxRetries: 1,
				},
			],
		});

		expect(providers.map((provider) => provider.type)).toEqual([
			"llama_cpp",
			"openai_compatible_remote",
		]);
	});

	test("merges preset defaults without overwriting repository-specific skills policy", () => {
		const merged = mergeSkillInstallConfig(
			{
				alwaysLoad: ["repo-specific-skill"],
				resolve: {
					precedence: [
						"alwaysLoad",
						"explicitName",
						"aliasOrTrigger",
						"lexical",
						"embeddings",
						"mcpEngineContext",
					],
					limit: 7,
				},
				read: {
					defaultMode: "instructions",
					progressiveDisclosure: "strict",
				},
				cache: {
					negativeCache: {
						enabled: true,
						ttlSeconds: 42,
					},
				},
				compression: {
					enabled: true,
					algorithm: "gzip",
					fallbackAlgorithm: "zstd",
					profile: "strict",
				},
				embeddings: {
					enabled: false,
					fallbackOnFailure: false,
					providers: [
						{
							type: "openai_compatible_remote",
							model: "remote-embedding-model",
							baseUrl: "https://example.invalid/v1",
							apiKey: "secret",
							timeoutMs: 5_000,
							maxRetries: 1,
						},
					],
				},
			},
			{
				presetId: "recommended",
			},
		);

		expect(merged.alwaysLoad).toEqual(["repo-specific-skill", "mimirmesh-agent-router"]);
		expect(merged.resolve.limit).toBe(7);
		expect(merged.read.defaultMode).toBe("instructions");
		expect(merged.cache.negativeCache.ttlSeconds).toBe(42);
		expect(merged.compression.algorithm).toBe("gzip");
		expect(merged.embeddings.enabled).toBe(true);
		expect(merged.embeddings.fallbackOnFailure).toBe(false);
		expect(merged.embeddings.providers).toEqual([
			{
				type: "openai_compatible_remote",
				model: "remote-embedding-model",
				baseUrl: "https://example.invalid/v1",
				apiKey: "secret",
				timeoutMs: 5_000,
				maxRetries: 1,
			},
		]);
	});

	test("requires complete non-interactive config for external embeddings modes", () => {
		expect(
			validateInstallationPolicy(
				createInstallationPolicy({
					mode: "non-interactive",
					presetId: "recommended",
					selectedAreas: ["core", "skills"],
					explicitAreaOverrides: ["core", "skills"],
					embeddings: {
						mode: "existing-openai-compatible",
					},
				}),
			),
		).toEqual({
			ok: false,
			errors: [
				"Existing OpenAI-compatible embeddings require `--embeddings-base-url` or an interactive prompt value.",
				"Existing OpenAI-compatible embeddings require `--embeddings-model` or an interactive prompt value.",
				"Existing OpenAI-compatible embeddings require `--embeddings-api-key` or an interactive prompt value.",
			],
		});

		expect(
			validateInstallationPolicy(
				createInstallationPolicy({
					mode: "non-interactive",
					presetId: "recommended",
					selectedAreas: ["core", "skills"],
					explicitAreaOverrides: ["core", "skills"],
					embeddings: {
						mode: "openai",
						model: "text-embedding-3-small",
					},
				}),
			),
		).toEqual({
			ok: false,
			errors: ["OpenAI embeddings require `--embeddings-api-key` or an interactive prompt value."],
		});
	});
});
