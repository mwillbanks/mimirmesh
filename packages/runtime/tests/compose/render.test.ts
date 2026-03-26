import { describe, expect, test } from "bun:test";

import { createDefaultConfig } from "@mimirmesh/config";
import type { RuntimeAdapterContext } from "@mimirmesh/mcp-adapters";

import { renderCompose } from "../../src/compose/render";

describe("runtime compose render", () => {
	test("renders real engine services and postgres", () => {
		const projectRoot = "/tmp/mimirmesh-render";
		const config = createDefaultConfig(projectRoot);
		const rendered = renderCompose(projectRoot, config);

		expect(rendered.includes("mm-postgres")).toBe(true);
		expect(rendered.includes("target: 5432")).toBe(true);
		expect(rendered.includes("host_ip: 127.0.0.1")).toBe(true);
		expect(rendered.includes("mm-srclight")).toBe(true);
		expect(rendered.includes("mm-document-mcp")).toBe(true);
		expect(rendered.includes("mm-adr-analysis")).toBe(true);
		expect(rendered.includes("mm-codebase-memory")).toBe(false);
		expect(rendered.includes("dockerfile")).toBe(true);
		expect(rendered.includes("MIMIRMESH_ENGINE_TRANSPORT: 'sse'")).toBe(true);
		expect(rendered.includes("host.docker.internal:host-gateway")).toBe(true);
	});

	test("emits srclight GPU reservation only when resolved policy enables GPU", () => {
		const projectRoot = "/tmp/mimirmesh-render";
		const config = createDefaultConfig(projectRoot);
		const adapterContext: RuntimeAdapterContext = {
			gpuResolutions: {
				srclight: {
					engineId: "srclight",
					configuredMode: "auto",
					engineSupportsGpu: true,
					hostNvidiaAvailable: true,
					effectiveUseGpu: true,
					runtimeVariant: "cuda",
					resolutionReason: "test",
					startupBlocked: false,
				},
			},
		};
		const gpuResolution = adapterContext.gpuResolutions?.srclight;
		if (!gpuResolution) {
			throw new Error("Expected srclight GPU resolution");
		}

		const gpuRendered = renderCompose(projectRoot, config, {
			adapterContext,
		});
		const cpuRendered = renderCompose(projectRoot, config, {
			adapterContext: {
				gpuResolutions: {
					srclight: {
						...gpuResolution,
						hostNvidiaAvailable: false,
						effectiveUseGpu: false,
						runtimeVariant: "cpu",
					},
				},
			},
		});

		expect(gpuRendered.includes("driver: nvidia")).toBe(true);
		expect(gpuRendered.includes("capabilities: [gpu]")).toBe(true);
		expect(cpuRendered.includes("driver: nvidia")).toBe(false);
	});

	test("renders the local llama.cpp provider service when embeddings select llama.cpp", () => {
		const projectRoot = "/tmp/mimirmesh-render-skills-provider";
		const config = createDefaultConfig(projectRoot);
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
		const adapterContext: RuntimeAdapterContext = {
			gpuResolutions: {
				srclight: {
					engineId: "srclight",
					configuredMode: "auto",
					engineSupportsGpu: true,
					hostNvidiaAvailable: true,
					effectiveUseGpu: true,
					runtimeVariant: "cuda",
					resolutionReason: "test",
					startupBlocked: false,
				},
			},
		};

		const rendered = renderCompose(projectRoot, config, { adapterContext });

		expect(rendered.includes("mm-llama-cpp")).toBe(true);
		expect(rendered.includes("mimirmesh/mm-llama-cpp:local-cuda")).toBe(true);
		expect(
			rendered.includes(
				"dockerfile: '/tmp/mimirmesh-render-skills-provider/.mimirmesh/runtime/images/llama-cpp/Dockerfile'",
			),
		).toBe(true);
		expect(
			rendered.includes("LLAMA_CPP_BASE_IMAGE: 'ghcr.io/ggml-org/llama.cpp:server-cuda'"),
		).toBe(true);
		expect(rendered.includes("MIMIRMESH_SKILLS_PROVIDER: 'llama_cpp'")).toBe(true);
		expect(rendered.includes("MIMIRMESH_SKILLS_MODEL: 'Qwen/Qwen3-Embedding-0.6B-GGUF'")).toBe(
			true,
		);
		expect(rendered.includes("LLAMA_CACHE: '/models'")).toBe(true);
		expect(rendered.includes("- '--embeddings'")).toBe(true);
	});
});
