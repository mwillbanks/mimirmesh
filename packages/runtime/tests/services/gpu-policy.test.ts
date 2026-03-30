import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const { createDefaultConfig } = await import("@mimirmesh/config");
const { detectHostGpuCapability, resolveGpuPolicy } = await import("../../src/services/gpu-policy");

const runCommandMock = mock(async () => ({
	exitCode: 0,
	stdout: '{"nvidia":{"path":"nvidia-container-runtime"}}',
	stderr: "",
}));

const gpuPolicyDependencies = {
	runCommand: runCommandMock as typeof import("../../src/services/command").runCommand,
};

describe("gpu policy resolution", () => {
	beforeEach(() => {
		runCommandMock.mockReset();
		runCommandMock.mockResolvedValue({
			exitCode: 0,
			stdout: '{"nvidia":{"path":"nvidia-container-runtime"}}',
			stderr: "",
		});
	});

	afterEach(() => {
		mock.restore();
	});

	test("detects NVIDIA runtime from docker info metadata", async () => {
		const capability = await detectHostGpuCapability(gpuPolicyDependencies);
		if (process.platform === "linux" && process.arch === "x64") {
			expect(capability.nvidiaRuntimeAvailable).toBe(true);
		} else {
			expect(capability.nvidiaRuntimeAvailable).toBe(false);
		}
	});

	test("forces CPU when gpuMode is off", async () => {
		const config = createDefaultConfig("/tmp/mimirmesh-gpu-off");
		config.runtime.gpuMode = "off";

		const resolved = await resolveGpuPolicy(config, gpuPolicyDependencies);
		expect(resolved.engines.srclight).toEqual(
			expect.objectContaining({
				configuredMode: "off",
				effectiveUseGpu: false,
				runtimeVariant: "cpu",
				startupBlocked: false,
			}),
		);
	});

	test("blocks startup when gpuMode is on without NVIDIA runtime support", async () => {
		runCommandMock.mockResolvedValue({
			exitCode: 0,
			stdout: "{}",
			stderr: "",
		});
		const config = createDefaultConfig("/tmp/mimirmesh-gpu-on");
		config.runtime.gpuMode = "on";

		const resolved = await resolveGpuPolicy(config, gpuPolicyDependencies);
		const srclight = resolved.engines.srclight;

		expect(srclight).toEqual(
			expect.objectContaining({
				configuredMode: "on",
				effectiveUseGpu: true,
				runtimeVariant: "cuda",
				startupBlocked: true,
			}),
		);
		expect(srclight?.startupBlockReason).toContain("runtime.gpuMode=on");
	});
});
