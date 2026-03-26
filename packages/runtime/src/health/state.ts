import type {
	ProjectRuntimeVersionRecord,
	RuntimeState,
	UpgradeStatusReport,
} from "@mimirmesh/config";

import type { SkillRegistryState } from "../state/skills";
import type {
	BootstrapStateFile,
	EngineRuntimeState,
	RuntimeHealth,
	RuntimeServiceStatus,
} from "../types";

export const inferRuntimeState = (options: {
	enabledEngineStates: EngineRuntimeState[];
	bootstrapState: BootstrapStateFile | null;
	routingTablePresent: boolean;
	unifiedRouteCount: number;
	requiredReportsGenerated: boolean;
	services: RuntimeServiceStatus[];
	baseReasons: string[];
	upgradeState?: UpgradeStatusReport["state"] | null;
	upgradeReasons?: string[];
}): { state: RuntimeState; reasons: string[] } => {
	const reasons = [...options.baseReasons];
	if (options.upgradeReasons?.length) {
		reasons.push(...options.upgradeReasons);
	}

	const unhealthyServiceCount = options.services.filter(
		(service) => service.state !== "running" || service.health === "unhealthy",
	).length;
	if (unhealthyServiceCount > 0) {
		reasons.push(`${unhealthyServiceCount} runtime service(s) are not healthy`);
	}

	const requiredEngines = options.enabledEngineStates.filter((engine) => engine.required);
	const optionalEngines = options.enabledEngineStates.filter((engine) => !engine.required);

	const unhealthyRequired = requiredEngines.filter(
		(engine) => !engine.bridge.healthy || engine.health.state !== "healthy",
	);
	const unhealthyOptional = optionalEngines.filter(
		(engine) => !engine.bridge.healthy || engine.health.state !== "healthy",
	);
	const degradedOptionalCapabilities = optionalEngines.filter(
		(engine) =>
			(engine.lastBootstrapResult === "failed" && engine.health.state === "healthy") ||
			(engine.capabilityWarnings?.length ?? 0) > 0,
	);

	if (unhealthyRequired.length > 0) {
		reasons.push(
			`Required engine(s) unhealthy: ${unhealthyRequired.map((engine) => engine.engine).join(", ")}`,
		);
	}

	if (unhealthyOptional.length > 0) {
		reasons.push(
			`Optional engine(s) degraded: ${unhealthyOptional.map((engine) => engine.engine).join(", ")}`,
		);
	}

	if (degradedOptionalCapabilities.length > 0) {
		reasons.push(
			`Optional capability degradation: ${degradedOptionalCapabilities
				.map(
					(engine) =>
						`${engine.engine}${
							engine.capabilityWarnings && engine.capabilityWarnings.length > 0
								? ` (${engine.capabilityWarnings.join(", ")})`
								: ""
						}`,
				)
				.join(", ")}`,
		);
	}

	const bootstrap = options.bootstrapState;
	const requiredBootstrap = bootstrap?.engines.filter((engine) => engine.required) ?? [];
	const failedBootstrap = requiredBootstrap.filter((engine) => !engine.completed);
	if (failedBootstrap.length > 0) {
		reasons.push(
			`Required bootstrap incomplete: ${failedBootstrap
				.map((entry) => `${entry.engine}${entry.failureReason ? ` (${entry.failureReason})` : ""}`)
				.join(", ")}`,
		);
	}

	if (options.enabledEngineStates.length === 0) {
		return {
			state: "failed",
			reasons: ["Engine discovery state is unavailable."],
		};
	}

	if (unhealthyRequired.length > 0) {
		return {
			state: "failed",
			reasons,
		};
	}

	if (options.bootstrapState === null) {
		reasons.push("Bootstrap state is unavailable.");
		return {
			state: "bootstrapping",
			reasons,
		};
	}

	const bootstrapFailures = failedBootstrap.filter((entry) => entry.failureReason);
	if (bootstrapFailures.length > 0) {
		return {
			state: "failed",
			reasons,
		};
	}

	if (failedBootstrap.length > 0 || requiredBootstrap.some((entry) => !entry.lastCompletedAt)) {
		return {
			state: "bootstrapping",
			reasons,
		};
	}

	if (!options.routingTablePresent) {
		reasons.push("Routing table has not been generated.");
		return {
			state: "bootstrapping",
			reasons,
		};
	}

	if (options.unifiedRouteCount === 0) {
		reasons.push("No unified routes are available from discovered engine capability.");
		return {
			state: "failed",
			reasons,
		};
	}

	if (!options.requiredReportsGenerated) {
		reasons.push("Required reports have not been generated.");
		return {
			state: "bootstrapping",
			reasons,
		};
	}

	if (options.upgradeState === "blocked") {
		return {
			state: "failed",
			reasons,
		};
	}

	if (options.upgradeState === "repairable" || options.upgradeState === "degraded") {
		return {
			state: "degraded",
			reasons,
		};
	}

	if (
		unhealthyOptional.length > 0 ||
		degradedOptionalCapabilities.length > 0 ||
		reasons.length > 0
	) {
		return {
			state: "degraded",
			reasons,
		};
	}

	return {
		state: "ready",
		reasons,
	};
};

export const buildRuntimeHealth = (options: {
	state: RuntimeState;
	dockerInstalled: boolean;
	dockerDaemonRunning: boolean;
	composeAvailable: boolean;
	reasons: string[];
	services: RuntimeServiceStatus[];
	bridges: RuntimeHealth["bridges"];
	runtimeVersion?: ProjectRuntimeVersionRecord | null;
	upgradeState?: UpgradeStatusReport["state"] | null;
	migrationStatus?: string | null;
	skillRegistry?: SkillRegistryState | null;
}): RuntimeHealth => ({
	timestamp: new Date().toISOString(),
	state: options.state,
	dockerInstalled: options.dockerInstalled,
	dockerDaemonRunning: options.dockerDaemonRunning,
	composeAvailable: options.composeAvailable,
	degraded: options.state !== "ready",
	reasons: options.reasons,
	services: options.services,
	bridges: options.bridges,
	runtimeVersion: options.runtimeVersion ?? null,
	upgradeState: options.upgradeState ?? null,
	migrationStatus: options.migrationStatus ?? null,
	skillRegistry: options.skillRegistry ?? null,
});
