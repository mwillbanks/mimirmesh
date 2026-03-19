import type { MimirmeshConfig } from "@mimirmesh/config";
import type { ProjectLogger } from "@mimirmesh/logging";
import type { RuntimeAdapterContext } from "@mimirmesh/mcp-adapters";

import { runBootstrap } from "../bootstrap/run";
import { generateRuntimeFiles } from "../compose/generate";
import { discoverEngineCapability } from "../discovery/discover";
import { detectDockerAvailability } from "../health/docker";
import { runCompose } from "../services/compose";
import { resolveBridgePorts } from "../services/ports";
import { runtimeStatus } from "../services/runtime-lifecycle";
import { loadConnection, persistConnection, persistRoutingTable } from "../state/io";
import { collectEngineUpgradeDecisions } from "./decisions";

const unique = <T>(items: T[]): T[] => [...new Set(items)];

export const reconcileRuntime = async (
	projectRoot: string,
	config: MimirmeshConfig,
	logger?: ProjectLogger,
	adapterContext?: RuntimeAdapterContext,
): Promise<{
	runtime: Awaited<ReturnType<typeof runtimeStatus>>;
	engineDecisions: Awaited<ReturnType<typeof collectEngineUpgradeDecisions>>;
	affectedServices: string[];
}> => {
	const engineDecisions = await collectEngineUpgradeDecisions(projectRoot, config, adapterContext);
	await generateRuntimeFiles(projectRoot, config);
	const availability = await detectDockerAvailability();
	if (
		!availability.dockerInstalled ||
		!availability.dockerDaemonRunning ||
		!availability.composeAvailable
	) {
		return {
			runtime: await runtimeStatus(projectRoot, config),
			engineDecisions,
			affectedServices: [],
		};
	}

	const connection = await loadConnection(projectRoot);
	const enabledEngines = Object.entries(config.engines)
		.filter(([, engine]) => engine.enabled)
		.map(([engine]) => engine);

	const servicesToRecreate = engineDecisions
		.filter((decision) => decision.runtimeAction === "recreate-service")
		.map((decision) => config.engines[decision.engine].serviceName);
	const servicesToRefresh = unique([
		...servicesToRecreate,
		...engineDecisions
			.filter(
				(decision) =>
					decision.runtimeAction === "restart-service" || decision.runtimeAction === "rebootstrap",
			)
			.map((decision) => config.engines[decision.engine].serviceName),
	]);

	for (const service of servicesToRecreate) {
		const build = await runCompose(config, ["build", service]);
		if (build.exitCode !== 0) {
			await logger?.log(
				"runtime",
				"warn",
				`Failed to build ${service}: ${build.stderr.trim() || build.stdout.trim()}`,
			);
		}
	}

	if (servicesToRefresh.length > 0) {
		const up = await runCompose(config, ["up", "-d", "mm-postgres", ...servicesToRefresh]);
		if (up.exitCode !== 0) {
			await logger?.log(
				"runtime",
				"warn",
				`Runtime reconciliation up failed: ${up.stderr.trim() || up.stdout.trim()}`,
			);
		}
	}

	const bridgePorts = await resolveBridgePorts(config, enabledEngines as never);
	const startedAt = connection?.startedAt ?? new Date().toISOString();
	if (connection && connection.startedAt !== startedAt) {
		connection.startedAt = startedAt;
		connection.updatedAt = new Date().toISOString();
		connection.bridgePorts = bridgePorts;
		await persistConnection(projectRoot, connection);
	}
	const discovery = await discoverEngineCapability({
		projectRoot,
		config,
		bridgePorts,
		startedAt,
		attempts: 2,
		delayMs: 500,
		adapterContext,
	});
	await persistRoutingTable(projectRoot, discovery.routingTable);

	if (engineDecisions.some((decision) => decision.runtimeAction === "rebootstrap")) {
		await runBootstrap({
			projectRoot,
			config,
			bridgePorts,
			engineStates: discovery.states,
		});
	}

	return {
		runtime: await runtimeStatus(projectRoot, config),
		engineDecisions,
		affectedServices: servicesToRefresh,
	};
};
