import type { EngineId, MimirmeshConfig } from "@mimirmesh/config";
import type { EngineGpuResolution, RuntimeAdapterContext } from "@mimirmesh/mcp-adapters";

import { runCommand } from "./command";

type GpuPolicyDependencies = {
	runCommand: typeof import("./command").runCommand;
};

const defaultGpuPolicyDependencies: GpuPolicyDependencies = {
	runCommand,
};

export type HostGpuCapability = {
	platform: NodeJS.Platform;
	arch: NodeJS.Architecture;
	supportedRuntimePlatform: boolean;
	nvidiaRuntimeAvailable: boolean;
	reason: string;
};

const gpuCapableEngines = new Set<EngineId>(["srclight"]);

const platformTag = (): Pick<
	HostGpuCapability,
	"platform" | "arch" | "supportedRuntimePlatform"
> => ({
	platform: process.platform,
	arch: process.arch,
	supportedRuntimePlatform: process.platform === "linux" && process.arch === "x64",
});

export const detectHostGpuCapability = async (
	dependencies: GpuPolicyDependencies = defaultGpuPolicyDependencies,
): Promise<HostGpuCapability> => {
	const base = platformTag();
	if (!base.supportedRuntimePlatform) {
		return {
			...base,
			nvidiaRuntimeAvailable: false,
			reason: `GPU runtime requires linux/x64 host support; detected ${base.platform}/${base.arch}`,
		};
	}

	const dockerInfo = await dependencies.runCommand([
		"docker",
		"info",
		"--format",
		"{{json .Runtimes}}",
	]);
	if (dockerInfo.exitCode !== 0) {
		return {
			...base,
			nvidiaRuntimeAvailable: false,
			reason:
				"NVIDIA container runtime unavailable because Docker runtime metadata could not be read",
		};
	}

	try {
		const parsed = JSON.parse(dockerInfo.stdout.trim()) as Record<string, unknown>;
		const nvidiaRuntimeAvailable =
			Object.hasOwn(parsed, "nvidia") || Object.hasOwn(parsed, "nvidia-container-runtime");

		return {
			...base,
			nvidiaRuntimeAvailable,
			reason: nvidiaRuntimeAvailable
				? "NVIDIA container runtime available"
				: "NVIDIA container runtime is not registered with Docker",
		};
	} catch {
		return {
			...base,
			nvidiaRuntimeAvailable: false,
			reason: "NVIDIA container runtime availability could not be parsed from Docker metadata",
		};
	}
};

const resolveGpuForEngine = (
	engineId: EngineId,
	configuredMode: MimirmeshConfig["runtime"]["gpuMode"],
	host: HostGpuCapability,
): EngineGpuResolution => {
	const engineSupportsGpu = gpuCapableEngines.has(engineId);
	if (!engineSupportsGpu) {
		return {
			engineId,
			configuredMode,
			engineSupportsGpu,
			hostNvidiaAvailable: host.nvidiaRuntimeAvailable,
			effectiveUseGpu: false,
			runtimeVariant: "cpu",
			resolutionReason: `${engineId} does not support GPU acceleration`,
			startupBlocked: false,
		};
	}

	if (configuredMode === "off") {
		return {
			engineId,
			configuredMode,
			engineSupportsGpu,
			hostNvidiaAvailable: host.nvidiaRuntimeAvailable,
			effectiveUseGpu: false,
			runtimeVariant: "cpu",
			resolutionReason: "GPU acceleration disabled by runtime.gpuMode=off",
			startupBlocked: false,
		};
	}

	if (configuredMode === "on") {
		return {
			engineId,
			configuredMode,
			engineSupportsGpu,
			hostNvidiaAvailable: host.nvidiaRuntimeAvailable,
			effectiveUseGpu: true,
			runtimeVariant: "cuda",
			resolutionReason: host.nvidiaRuntimeAvailable
				? "GPU acceleration required by runtime.gpuMode=on"
				: `GPU acceleration required by runtime.gpuMode=on but unavailable: ${host.reason}`,
			startupBlocked: !host.nvidiaRuntimeAvailable,
			startupBlockReason: host.nvidiaRuntimeAvailable
				? undefined
				: `runtime.gpuMode=on requires NVIDIA container runtime support for ${engineId}: ${host.reason}`,
		};
	}

	const effectiveUseGpu = host.nvidiaRuntimeAvailable;
	return {
		engineId,
		configuredMode,
		engineSupportsGpu,
		hostNvidiaAvailable: host.nvidiaRuntimeAvailable,
		effectiveUseGpu,
		runtimeVariant: effectiveUseGpu ? "cuda" : "cpu",
		resolutionReason: effectiveUseGpu
			? "GPU acceleration enabled automatically because NVIDIA container runtime is available"
			: `CPU fallback selected automatically: ${host.reason}`,
		startupBlocked: false,
	};
};

export const resolveGpuPolicy = async (
	config: MimirmeshConfig,
	dependencies: GpuPolicyDependencies = defaultGpuPolicyDependencies,
): Promise<{
	host: HostGpuCapability;
	engines: Partial<Record<EngineId, EngineGpuResolution>>;
}> => {
	const host = await detectHostGpuCapability(dependencies);
	const engines = Object.fromEntries(
		(Object.keys(config.engines) as EngineId[]).map((engineId) => [
			engineId,
			resolveGpuForEngine(engineId, config.runtime.gpuMode, host),
		]),
	) as Partial<Record<EngineId, EngineGpuResolution>>;

	return {
		host,
		engines,
	};
};

export const resolveRuntimeAdapterContext = async (
	config: MimirmeshConfig,
	dependencies: GpuPolicyDependencies = defaultGpuPolicyDependencies,
): Promise<RuntimeAdapterContext> => {
	const resolved = await resolveGpuPolicy(config, dependencies);

	return {
		gpuResolutions: resolved.engines,
	};
};
