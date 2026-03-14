import { access } from "node:fs/promises";
import { join } from "node:path";
import { type EngineId, listEnabledEngines, type MimirmeshConfig } from "@mimirmesh/config";
import type { ProjectLogger } from "@mimirmesh/logging";
import {
	allEngineAdapters,
	type EngineGpuResolution,
	type RuntimeAdapterContext,
	translateAllEngineConfigs,
} from "@mimirmesh/mcp-adapters";

import { runBootstrap } from "../bootstrap/run";
import { generateRuntimeFiles } from "../compose/generate";
import { renderCompose } from "../compose/render";
import { discoverEngineCapability } from "../discovery/discover";
import { parseComposePs } from "../health/compose";
import { detectDockerAvailability } from "../health/docker";
import { buildRuntimeHealth, inferRuntimeState } from "../health/state";
import {
	collectSrclightRepoLocalEvidence,
	hashValue,
	loadBootstrapState,
	loadConnection,
	loadHealth,
	loadRoutingTable,
	persistConnection,
	persistEngineState,
	persistHealth,
	persistRoutingTable,
} from "../state/io";
import { ensureProjectLayout } from "../state/layout";
import type {
	EngineRuntimeState,
	RuntimeActionResult,
	RuntimeBridgeInfo,
	RuntimeConnection,
} from "../types";
import {
	classifyUpgradeStatus,
	detectProjectRuntimeVersion,
	persistRuntimeVersionEvidence,
	reconcileRuntime,
} from "../upgrade";
import { checkBridgeHealth } from "./bridge";
import { composeDown, composePsJson, runCompose } from "./compose";
import { resolveRuntimeAdapterContext } from "./gpu-policy";
import { resolveBridgePorts } from "./ports";

const enabledServiceNames = (config: MimirmeshConfig): string[] => {
	const enabled = new Set(listEnabledEngines(config));
	const services = allEngineAdapters
		.filter((adapter) => enabled.has(adapter.id))
		.map((adapter) => config.engines[adapter.id].serviceName);
	return ["mm-postgres", ...services];
};

const requiredReportFiles = [
	"project-summary.md",
	"architecture.md",
	"deployment.md",
	"runtime-health.md",
	"speckit-status.md",
];

const reportsGenerated = async (projectRoot: string): Promise<boolean> => {
	for (const report of requiredReportFiles) {
		try {
			await access(join(projectRoot, ".mimirmesh", "reports", report));
		} catch {
			return false;
		}
	}
	return true;
};

const bridgeTransportForEngine = (
	config: MimirmeshConfig,
	engine: EngineId,
): RuntimeBridgeInfo["transport"] => {
	if (engine !== "srclight") {
		return "stdio";
	}

	const settings = config.engines.srclight.settings as { transport: "stdio" | "sse" };
	return settings.transport === "sse" ? "sse" : "stdio";
};

const resolveBridgeState = async (
	bridgePorts: Partial<Record<EngineId, number>>,
	config: MimirmeshConfig,
): Promise<RuntimeBridgeInfo[]> => {
	const entries = Object.entries(bridgePorts) as Array<[EngineId, number]>;
	const states: RuntimeBridgeInfo[] = [];

	for (const [engine, port] of entries) {
		const url = `http://127.0.0.1:${port}`;
		try {
			const response = await checkBridgeHealth(url);
			const healthy = Boolean(response.ok && response.ready && response.child?.running);
			states.push({
				engine,
				url,
				transport: bridgeTransportForEngine(config, engine),
				healthy,
				reason: healthy ? undefined : (response.child?.lastError ?? "Bridge not ready"),
				checkedAt: new Date().toISOString(),
			});
		} catch (error) {
			states.push({
				engine,
				url,
				transport: bridgeTransportForEngine(config, engine),
				healthy: false,
				reason: error instanceof Error ? error.message : String(error),
				checkedAt: new Date().toISOString(),
			});
		}
	}

	return states;
};

const srclightGitToolNames = new Set([
	"blame_symbol",
	"recent_changes",
	"git_hotspots",
	"whats_changed",
	"changes_to",
]);

const srclightGitWarnings = [
	"git-backed Srclight tools unavailable until git is installed and the repository metadata is visible in the container",
	"recent_changes, whats_changed, git_hotspots, blame_symbol, and changes_to are unavailable",
];

const shellQuote = (value: string): string => `'${value.replaceAll("'", `'"'"'`)}'`;

const withoutSrclightGitWarnings = (warnings: string[]): string[] =>
	warnings.filter((warning) => !srclightGitWarnings.includes(warning));

const resolveSrclightRepoMount = (projectRoot: string, config: MimirmeshConfig): string =>
	translateAllEngineConfigs(projectRoot, config).find((engine) => engine.contract.id === "srclight")
		?.contract.mounts.repo ?? "/workspace";

const applySrclightCapabilityChecks = async (
	projectRoot: string,
	config: MimirmeshConfig,
	states: EngineRuntimeState[],
): Promise<void> => {
	const srclight = states.find((state) => state.engine === "srclight");
	if (!srclight?.enabled) {
		return;
	}

	const discoveredGitTools = srclight.discoveredTools.some((tool) =>
		srclightGitToolNames.has(tool.name),
	);
	const warnings = withoutSrclightGitWarnings(srclight.capabilityWarnings ?? []);
	srclight.capabilityWarnings = warnings;

	if (!srclight.bridge.healthy) {
		await persistEngineState(projectRoot, srclight);
		return;
	}

	const repoMount = resolveSrclightRepoMount(projectRoot, config);
	const probeScript = [
		"git_ok=0",
		"repo_ok=0",
		"worktree_ok=0",
		`if command -v git >/dev/null 2>&1; then git_ok=1; fi`,
		`if [ -e ${shellQuote(join(repoMount, ".git"))} ]; then repo_ok=1; fi`,
		`if [ "$git_ok" -eq 1 ] && git -C ${shellQuote(repoMount)} rev-parse --git-dir >/dev/null 2>&1; then worktree_ok=1; fi`,
		'printf "git=%s\\nrepo=%s\\nworktree=%s\\n" "$git_ok" "$repo_ok" "$worktree_ok"',
	].join("; ");

	try {
		const result = await runCompose(config, [
			"exec",
			"-T",
			config.engines.srclight.serviceName,
			"sh",
			"-lc",
			probeScript,
		]);
		if (result.exitCode !== 0 && !result.stdout.includes("git=")) {
			throw new Error(result.stderr.trim() || result.stdout.trim() || "Srclight git probe failed");
		}

		const gitBinaryAvailable = /(?:^|\n)git=1(?:\n|$)/.test(result.stdout);
		const gitRepoVisible = /(?:^|\n)repo=1(?:\n|$)/.test(result.stdout);
		const gitWorkTreeAccessible = /(?:^|\n)worktree=1(?:\n|$)/.test(result.stdout);

		const capabilityMessage = !gitBinaryAvailable
			? "git executable is missing in the Srclight container"
			: !gitRepoVisible
				? `${join(repoMount, ".git")} is not visible in the Srclight container`
				: !gitWorkTreeAccessible
					? `${repoMount} is not a valid git work tree inside the Srclight container`
					: "git-backed repository intelligence available";

		srclight.runtimeEvidence = {
			...(srclight.runtimeEvidence ?? { bootstrapMode: "command" }),
			gitBinaryAvailable,
			gitRepoVisible,
			gitWorkTreeAccessible,
			gitCapabilityMessage: capabilityMessage,
		};

		if (!gitBinaryAvailable || !gitRepoVisible || !gitWorkTreeAccessible || !discoveredGitTools) {
			srclight.capabilityWarnings = [...warnings, ...srclightGitWarnings];
		} else {
			srclight.capabilityWarnings = warnings;
		}
	} catch (error) {
		srclight.runtimeEvidence = {
			...(srclight.runtimeEvidence ?? { bootstrapMode: "command" }),
			gitBinaryAvailable: false,
			gitRepoVisible: false,
			gitWorkTreeAccessible: false,
			gitCapabilityMessage: error instanceof Error ? error.message : String(error),
		};
		srclight.capabilityWarnings = [...warnings, ...srclightGitWarnings];
	}

	await persistEngineState(projectRoot, srclight);
};

const baseConnection = (config: MimirmeshConfig): RuntimeConnection => ({
	projectName: config.runtime.projectName,
	composeFile: config.runtime.composeFile,
	updatedAt: new Date().toISOString(),
	startedAt: null,
	mounts: {
		repository: config.project.rootPath,
		mimirmesh: `${config.project.rootPath}/.mimirmesh`,
	},
	services: enabledServiceNames(config),
	bridgePorts: {},
});

type EngineBuildFailure = {
	engine: EngineId;
	serviceName: string;
	required: boolean;
	message: string;
	kind: "config" | "build";
};

const configValidationFailures = (
	projectRoot: string,
	config: MimirmeshConfig,
	adapterContext?: RuntimeAdapterContext,
): EngineBuildFailure[] => {
	return translateAllEngineConfigs(projectRoot, config, adapterContext)
		.filter((engine) => engine.errors.length > 0)
		.map((engine) => ({
			engine: engine.contract.id,
			serviceName: engine.contract.serviceName,
			required: Boolean(config.engines[engine.contract.id].required),
			message: engine.errors.join("; "),
			kind: "config" as const,
		}));
};

const buildEngineServices = async (
	config: MimirmeshConfig,
	enabledEngines: EngineId[],
): Promise<EngineBuildFailure[]> => {
	const failures: EngineBuildFailure[] = [];

	for (const engine of enabledEngines) {
		const serviceName = config.engines[engine].serviceName;
		const required = Boolean(config.engines[engine].required);
		const build = await runCompose(config, ["build", serviceName]);
		if (build.exitCode !== 0) {
			failures.push({
				engine,
				serviceName,
				required,
				message: build.stderr.trim() || build.stdout.trim() || `Build failed for ${serviceName}`,
				kind: "build",
			});
		}
	}

	return failures;
};

const runtimeUnavailableResult = async (options: {
	projectRoot: string;
	config: MimirmeshConfig;
	action: RuntimeActionResult["action"];
	reasons: string[];
}): Promise<RuntimeActionResult> => {
	const connection = (await loadConnection(options.projectRoot)) ?? baseConnection(options.config);
	const runtimeVersion = await detectProjectRuntimeVersion(options.projectRoot);
	const health = buildRuntimeHealth({
		state: "failed",
		dockerInstalled: false,
		dockerDaemonRunning: false,
		composeAvailable: false,
		reasons: options.reasons,
		services: [],
		bridges: [],
		runtimeVersion,
		upgradeState: null,
		migrationStatus: null,
	});

	await persistConnection(options.projectRoot, connection);
	await persistHealth(options.projectRoot, health);

	return {
		ok: false,
		action: options.action,
		message: options.reasons.join(" "),
		health,
		connection,
		runtimeVersion,
		upgradeStatus: null,
	};
};

export const runtimeStatus = async (
	projectRoot: string,
	config: MimirmeshConfig,
): Promise<RuntimeActionResult> => {
	await ensureProjectLayout(projectRoot);
	const availability = await detectDockerAvailability();
	if (
		!availability.dockerInstalled ||
		!availability.dockerDaemonRunning ||
		!availability.composeAvailable
	) {
		return runtimeUnavailableResult({
			projectRoot,
			config,
			action: "status",
			reasons: availability.reasons,
		});
	}

	const ps = await composePsJson(config);
	const services = ps.exitCode === 0 ? parseComposePs(ps.stdout) : [];
	const enabled = listEnabledEngines(config);
	const bridgePorts = await resolveBridgePorts(config, enabled);
	const existingConnection = (await loadConnection(projectRoot)) ?? baseConnection(config);
	const adapterContext = await resolveRuntimeAdapterContext(config);
	const discovery = await discoverEngineCapability({
		projectRoot,
		config,
		bridgePorts,
		startedAt: existingConnection.startedAt ?? new Date().toISOString(),
		attempts: 2,
		delayMs: 500,
		adapterContext,
	});
	await applySrclightCapabilityChecks(projectRoot, config, discovery.states);
	await persistRoutingTable(projectRoot, discovery.routingTable);
	const bridges = await resolveBridgeState(bridgePorts, config);

	const bootstrap = await loadBootstrapState(projectRoot);
	const hasRequiredReports = await reportsGenerated(projectRoot);
	const runtimeVersion = await detectProjectRuntimeVersion(projectRoot);
	const upgradeStatus = await classifyUpgradeStatus(projectRoot, config);

	const inferred = inferRuntimeState({
		enabledEngineStates: discovery.states.filter((engine) => engine.enabled),
		bootstrapState: bootstrap,
		routingTablePresent: true,
		unifiedRouteCount: discovery.routingTable.unified.length,
		requiredReportsGenerated: hasRequiredReports,
		services,
		baseReasons: availability.reasons,
		upgradeState: upgradeStatus.report.state,
		upgradeReasons: upgradeStatus.report.warnings,
	});

	const health = buildRuntimeHealth({
		state: inferred.state,
		dockerInstalled: availability.dockerInstalled,
		dockerDaemonRunning: availability.dockerDaemonRunning,
		composeAvailable: availability.composeAvailable,
		reasons: inferred.reasons,
		services,
		bridges,
		runtimeVersion,
		upgradeState: upgradeStatus.report.state,
		migrationStatus: upgradeStatus.report.requiredActions.join(", "),
	});

	const connection = existingConnection;
	if (!connection.startedAt) {
		const discoveredStartedAt =
			discovery.states.find(
				(state) => typeof state.lastStartupAt === "string" && state.lastStartupAt,
			)?.lastStartupAt ?? (services.length > 0 ? new Date().toISOString() : null);
		connection.startedAt = discoveredStartedAt;
	}
	connection.updatedAt = new Date().toISOString();
	connection.bridgePorts = bridgePorts;

	await persistConnection(projectRoot, connection);
	await persistHealth(projectRoot, health);
	await persistRuntimeVersionEvidence(projectRoot, {
		generatedBy: "runtime-status",
		statusReport: upgradeStatus.report,
		preservedAssets: upgradeStatus.preservedAssets,
		engineDecisions: upgradeStatus.engineDecisions,
	});

	return {
		ok: health.state === "ready" || health.state === "degraded",
		action: "status",
		message: `Runtime is ${health.state}.`,
		health,
		connection,
		runtimeVersion,
		upgradeStatus: upgradeStatus.report,
	};
};

export const runtimeStart = async (
	projectRoot: string,
	config: MimirmeshConfig,
	logger?: ProjectLogger,
): Promise<RuntimeActionResult> => {
	await ensureProjectLayout(projectRoot);
	const adapterContext = await resolveRuntimeAdapterContext(config);
	const generated = await generateRuntimeFiles(projectRoot, config, {
		adapterContext,
	});
	await persistConnection(projectRoot, generated.connection);

	const availability = await detectDockerAvailability();
	if (
		!availability.dockerInstalled ||
		!availability.dockerDaemonRunning ||
		!availability.composeAvailable
	) {
		return runtimeUnavailableResult({
			projectRoot,
			config,
			action: "start",
			reasons: availability.reasons,
		});
	}

	const enabledEngines = listEnabledEngines(config);
	const gpuResolutionBlocks = enabledEngines
		.map((engineId) => adapterContext.gpuResolutions?.[engineId])
		.filter((resolution): resolution is EngineGpuResolution => Boolean(resolution?.startupBlocked));

	if (gpuResolutionBlocks.length > 0) {
		return runtimeUnavailableResult({
			projectRoot,
			config,
			action: "start",
			reasons: gpuResolutionBlocks.map(
				(resolution) =>
					resolution.startupBlockReason ??
					`GPU policy blocked startup for ${resolution.engineId}: ${resolution.resolutionReason}`,
			),
		});
	}

	const preflightFailures = configValidationFailures(projectRoot, config, adapterContext);
	const blockedPreflight = new Set(preflightFailures.map((failure) => failure.engine));
	const buildFailures = await buildEngineServices(
		config,
		enabledEngines.filter((engine) => !blockedPreflight.has(engine)),
	);
	const startupFailures = [...preflightFailures, ...buildFailures];
	const requiredBuildFailures = startupFailures.filter((failure) => failure.required);
	const optionalBuildFailures = startupFailures.filter((failure) => !failure.required);

	if (requiredBuildFailures.length > 0) {
		await logger?.error(
			"docker compose build failed",
			requiredBuildFailures.map((failure) => `${failure.engine}: ${failure.message}`).join("\n"),
		);
		return runtimeUnavailableResult({
			projectRoot,
			config,
			action: "start",
			reasons: [
				"docker compose build failed for required engine services",
				...requiredBuildFailures.map((failure) => `${failure.engine}: ${failure.message}`),
			],
		});
	}

	if (optionalBuildFailures.length > 0) {
		await logger?.log(
			"runtime",
			"warn",
			`Optional engine build failures: ${optionalBuildFailures
				.map((failure) => failure.engine)
				.join(", ")}`,
		);
	}

	const blockedOptional = new Set(optionalBuildFailures.map((failure) => failure.engine));
	const runnableEngines = enabledEngines.filter((engine) => !blockedOptional.has(engine));
	const runnableServices = runnableEngines.map((engine) => config.engines[engine].serviceName);

	const up = await runCompose(config, ["up", "-d", "mm-postgres", ...runnableServices]);
	if (up.exitCode !== 0) {
		await logger?.error("docker compose up failed", up.stderr || up.stdout);
		return runtimeUnavailableResult({
			projectRoot,
			config,
			action: "start",
			reasons: ["docker compose up failed", up.stderr.trim() || up.stdout.trim()],
		});
	}

	const startedAt = new Date().toISOString();
	const ps = await composePsJson(config);
	const services = ps.exitCode === 0 ? parseComposePs(ps.stdout) : [];

	const runtimeConfig: MimirmeshConfig = {
		...config,
		engines: {
			...config.engines,
			srclight: { ...config.engines.srclight },
			"document-mcp": { ...config.engines["document-mcp"] },
			"mcp-adr-analysis-server": { ...config.engines["mcp-adr-analysis-server"] },
			"codebase-memory-mcp": { ...config.engines["codebase-memory-mcp"] },
		},
	};

	for (const engine of blockedOptional) {
		switch (engine) {
			case "srclight":
				runtimeConfig.engines.srclight = {
					...runtimeConfig.engines.srclight,
					enabled: false,
				};
				break;
			case "document-mcp":
				runtimeConfig.engines["document-mcp"] = {
					...runtimeConfig.engines["document-mcp"],
					enabled: false,
				};
				break;
			case "mcp-adr-analysis-server":
				runtimeConfig.engines["mcp-adr-analysis-server"] = {
					...runtimeConfig.engines["mcp-adr-analysis-server"],
					enabled: false,
				};
				break;
			case "codebase-memory-mcp":
				runtimeConfig.engines["codebase-memory-mcp"] = {
					...runtimeConfig.engines["codebase-memory-mcp"],
					enabled: false,
				};
				break;
		}
	}

	const bridgePorts = await resolveBridgePorts(runtimeConfig, runnableEngines);

	const discovery = await discoverEngineCapability({
		projectRoot,
		config: runtimeConfig,
		bridgePorts,
		startedAt,
		attempts: 3,
		delayMs: 1_000,
		adapterContext,
	});

	const optionalFailureStates: EngineRuntimeState[] = [];
	for (const failure of optionalBuildFailures) {
		const engineConfig = config.engines[failure.engine];
		const srclightEvidence =
			failure.engine === "srclight" ? await collectSrclightRepoLocalEvidence(projectRoot) : null;
		const gpuResolution = adapterContext.gpuResolutions?.[failure.engine];
		const state: EngineRuntimeState = {
			engine: failure.engine,
			enabled: true,
			required: false,
			namespace: engineConfig.namespace,
			serviceName: engineConfig.serviceName,
			imageTag: engineConfig.image.tag,
			configHash: hashValue(engineConfig.settings),
			discoveredTools: [],
			health: {
				state: "unhealthy",
				message: "build failed",
				checkedAt: new Date().toISOString(),
			},
			bridge: {
				url: "",
				transport: bridgeTransportForEngine(config, failure.engine),
				healthy: false,
				checkedAt: new Date().toISOString(),
				lastError: failure.message,
			},
			lastStartupAt: startedAt,
			lastBootstrapAt: null,
			lastBootstrapResult: "failed",
			degradedReason: failure.message,
			capabilityWarnings: [],
			runtimeEvidence:
				failure.engine === "srclight"
					? {
							bootstrapMode: "command",
							...(srclightEvidence ?? {}),
							...(gpuResolution
								? {
										gpuMode: gpuResolution.configuredMode,
										effectiveUseGpu: gpuResolution.effectiveUseGpu,
										runtimeVariant: gpuResolution.runtimeVariant,
										hostNvidiaAvailable: gpuResolution.hostNvidiaAvailable,
										gpuResolutionReason: gpuResolution.resolutionReason,
									}
								: {}),
						}
					: {
							bootstrapMode: failure.engine === "codebase-memory-mcp" ? "tool" : "none",
						},
		};
		if (failure.kind === "config") {
			state.health.message = "configuration invalid";
			state.lastBootstrapResult = "skipped";
		}
		optionalFailureStates.push(state);
		await persistEngineState(projectRoot, state);
	}

	await persistRoutingTable(projectRoot, discovery.routingTable);

	const bootstrap = await runBootstrap({
		projectRoot,
		config: runtimeConfig,
		bridgePorts,
		engineStates: discovery.states,
	});
	await applySrclightCapabilityChecks(projectRoot, runtimeConfig, discovery.states);

	const bridges = await resolveBridgeState(bridgePorts, runtimeConfig);
	const hasRequiredReports = await reportsGenerated(projectRoot);
	const runtimeVersion = await detectProjectRuntimeVersion(projectRoot);
	const upgradeStatus = await classifyUpgradeStatus(projectRoot, config);

	const allEngineStates = [...discovery.states, ...optionalFailureStates];
	const inferred = inferRuntimeState({
		enabledEngineStates: allEngineStates.filter((entry) => entry.enabled),
		bootstrapState: bootstrap,
		routingTablePresent: true,
		unifiedRouteCount: discovery.routingTable.unified.length,
		requiredReportsGenerated: hasRequiredReports,
		services,
		baseReasons: [
			...availability.reasons,
			...optionalBuildFailures.map((failure) =>
				failure.kind === "config"
					? `${failure.engine} configuration invalid`
					: `${failure.engine} build failed`,
			),
		],
		upgradeState: upgradeStatus.report.state,
		upgradeReasons: upgradeStatus.report.warnings,
	});

	const health = buildRuntimeHealth({
		state: inferred.state,
		dockerInstalled: availability.dockerInstalled,
		dockerDaemonRunning: availability.dockerDaemonRunning,
		composeAvailable: availability.composeAvailable,
		reasons: inferred.reasons,
		services,
		bridges,
		runtimeVersion,
		upgradeState: upgradeStatus.report.state,
		migrationStatus: upgradeStatus.report.requiredActions.join(", "),
	});

	const connection = {
		...((await loadConnection(projectRoot)) ?? baseConnection(config)),
		startedAt,
		updatedAt: new Date().toISOString(),
		bridgePorts,
		services: ["mm-postgres", ...runnableServices],
	};

	await persistConnection(projectRoot, connection);
	await persistHealth(projectRoot, health);
	await persistRuntimeVersionEvidence(projectRoot, {
		generatedBy: "runtime-start",
		statusReport: upgradeStatus.report,
		preservedAssets: upgradeStatus.preservedAssets,
		engineDecisions: upgradeStatus.engineDecisions,
	});

	const statusMessage =
		health.state === "ready"
			? "Runtime started and ready."
			: health.state === "bootstrapping"
				? "Runtime started and is bootstrapping."
				: `Runtime started in ${health.state} mode.`;

	await logger?.log("runtime", health.state === "ready" ? "info" : "warn", statusMessage);

	return {
		ok: health.state === "ready" || health.state === "degraded" || health.state === "bootstrapping",
		action: "start",
		message: statusMessage,
		health,
		connection,
		runtimeVersion,
		upgradeStatus: upgradeStatus.report,
	};
};

export const runtimeStop = async (
	projectRoot: string,
	config: MimirmeshConfig,
	logger?: ProjectLogger,
): Promise<RuntimeActionResult> => {
	await ensureProjectLayout(projectRoot);

	const availability = await detectDockerAvailability();
	if (
		availability.dockerInstalled &&
		availability.dockerDaemonRunning &&
		availability.composeAvailable
	) {
		const down = await composeDown(config);
		if (down.exitCode !== 0) {
			await logger?.error("docker compose down failed", down.stderr || down.stdout);
		}
	}

	const connection = (await loadConnection(projectRoot)) ?? baseConnection(config);
	connection.startedAt = null;
	connection.updatedAt = new Date().toISOString();
	const runtimeVersion = await detectProjectRuntimeVersion(projectRoot);

	const health = buildRuntimeHealth({
		state: "failed",
		dockerInstalled: availability.dockerInstalled,
		dockerDaemonRunning: availability.dockerDaemonRunning,
		composeAvailable: availability.composeAvailable,
		reasons: availability.reasons.length > 0 ? availability.reasons : ["Runtime stopped."],
		services: [],
		bridges: [],
		runtimeVersion,
		upgradeState: null,
		migrationStatus: null,
	});

	await persistConnection(projectRoot, connection);
	await persistHealth(projectRoot, health);
	await logger?.log("runtime", "info", "Runtime stopped.");

	return {
		ok: true,
		action: "stop",
		message: "Runtime stopped.",
		health,
		connection,
		runtimeVersion,
		upgradeStatus: null,
	};
};

export const runtimeRestart = async (
	projectRoot: string,
	config: MimirmeshConfig,
	logger?: ProjectLogger,
): Promise<RuntimeActionResult> => {
	await runtimeStop(projectRoot, config, logger);
	return runtimeStart(projectRoot, config, logger);
};

export const runtimeRefresh = async (
	projectRoot: string,
	config: MimirmeshConfig,
	logger?: ProjectLogger,
): Promise<RuntimeActionResult> => {
	const refreshed = await reconcileRuntime(projectRoot, config, logger);
	return {
		...refreshed.runtime,
		action: "refresh",
		message:
			refreshed.affectedServices.length > 0
				? `Runtime refreshed: ${refreshed.affectedServices.join(", ")}`
				: "Runtime refresh completed with no service changes.",
	};
};

export const dockerComposeRender = async (
	config: MimirmeshConfig,
): Promise<{ ok: boolean; output: string; error?: string }> => {
	const adapterContext = await resolveRuntimeAdapterContext(config);
	const fallbackRender = renderCompose(config.project.rootPath, config, {
		adapterContext,
	});
	const rendered = await runCompose(config, ["config"]);
	return rendered.exitCode === 0
		? { ok: true, output: rendered.stdout }
		: { ok: false, output: fallbackRender, error: rendered.stderr };
};

export const loadRuntimeRouting = async (projectRoot: string) => loadRoutingTable(projectRoot);
export const loadRuntimeHealth = async (projectRoot: string) => loadHealth(projectRoot);
