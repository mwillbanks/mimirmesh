import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const commandMock = {
	runCommand: mock(async () => ({
		exitCode: 0,
		stdout: '{"nvidia":{"path":"nvidia-container-runtime"}}',
		stderr: "",
	})),
};

mock.module("../../src/services/command", () => commandMock);

const { createDefaultConfig } = await import("@mimirmesh/config");
const { detectHostGpuCapability, resolveGpuPolicy } = await import("../../src/services/gpu-policy");

describe("gpu policy resolution", () => {
	beforeEach(() => {
		commandMock.runCommand.mockReset();
		commandMock.runCommand.mockResolvedValue({
			exitCode: 0,
			stdout: '{"nvidia":{"path":"nvidia-container-runtime"}}',
			stderr: "",
		});
	});

	afterEach(() => {
		mock.restore();
	});

	test("detects NVIDIA runtime from docker info metadata", async () => {
		const capability = await detectHostGpuCapability();
		if (process.platform === "linux" && process.arch === "x64") {
			expect(capability.nvidiaRuntimeAvailable).toBe(true);
		} else {
			expect(capability.nvidiaRuntimeAvailable).toBe(false);
		}
	});

	test("forces CPU when gpuMode is off", async () => {
		const config = createDefaultConfig("/tmp/mimirmesh-gpu-off");
		config.runtime.gpuMode = "off";

		const resolved = await resolveGpuPolicy(config);
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
		commandMock.runCommand.mockResolvedValue({
			exitCode: 0,
			stdout: "{}",
			stderr: "",
		});
		const config = createDefaultConfig("/tmp/mimirmesh-gpu-on");
		config.runtime.gpuMode = "on";

		const resolved = await resolveGpuPolicy(config);
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
