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
});
