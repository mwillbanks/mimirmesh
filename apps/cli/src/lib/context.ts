import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import {
	createDefaultConfig,
	disableEngine,
	type EngineId,
	enableEngine,
	getConfigPath,
	type MimirmeshConfig,
	parseConfigPrimitive,
	readConfig,
	readGlobalConfig,
	setConfigValue,
	validateConfigFile,
	writeConfig,
	writeSkillsConfig,
} from "@mimirmesh/config";
import {
	buildInstallChangeSummary,
	checkForUpdates,
	createInstallationStateSnapshot,
	type EmbeddingsInstallConfig,
	type InstallAreaId,
	type InstallationPolicy,
	type InstallationStateSnapshot,
	type InstallChangeSummary,
	type InstallPresetId,
	installIdeConfig,
	mergeSkillInstallConfig,
	performUpdate,
} from "@mimirmesh/installer";
import { createProjectLogger, type ProjectLogger } from "@mimirmesh/logging";
import { createAdapters } from "@mimirmesh/mcp-adapters";
import { createToolRouter, type ToolRouter } from "@mimirmesh/mcp-core";
import { generateAllReports, readReportPath } from "@mimirmesh/reports";
import {
	buildRuntimeHealth,
	classifyUpgradeStatus,
	detectDockerAvailability,
	detectHostGpuCapability,
	ensureProjectLayout,
	ensureSkillRegistryState,
	generateRuntimeFiles,
	loadBootstrapState,
	loadRoutingTable,
	loadRuntimeHealth,
	migrateRuntime,
	persistRuntimeVersionEvidence,
	repairRuntime,
	runtimeRefresh,
	runtimeRestart,
	runtimeStart,
	runtimeStatus,
	runtimeStop,
	validatePreservedAssets,
} from "@mimirmesh/runtime";
import {
	bundledSkillNames,
	ensureManagedAgentsSection,
	type InstalledBundledSkill,
	installBundledSkills,
	listInstalledBundledSkills,
	removeBundledSkills,
	type SkillInstallMode,
	updateBundledSkills,
} from "@mimirmesh/skills";
import {
	analyzeRepository,
	collectRepositoryFiles,
	detectSpecKit,
	doctorSpecKit,
	initializeSpecKit,
	type RepositoryAnalysis,
	searchInRepository,
} from "@mimirmesh/workspace";

export type CliContext = {
	projectRoot: string;
	sessionId: string;
	config: MimirmeshConfig;
	logger: ProjectLogger;
	router: ToolRouter;
};

type InstallPreviewContext = Pick<CliContext, "projectRoot" | "config">;

const makeRouter = (
	projectRoot: string,
	config: MimirmeshConfig,
	logger: ProjectLogger,
	sessionId: string,
): ToolRouter => {
	const adapters = createAdapters(config);
	return createToolRouter({
		projectRoot,
		config,
		sessionId,
		adapters,
		logger,
	});
};

const resolveCliSessionId = (): string => process.env.MIMIRMESH_SESSION_ID?.trim() || "cli-default";

export const loadCliContext = async (projectRoot = process.cwd()): Promise<CliContext> => {
	const resolvedProjectRoot = process.env.MIMIRMESH_PROJECT_ROOT ?? projectRoot;
	await ensureProjectLayout(resolvedProjectRoot);
	const config = await readConfig(resolvedProjectRoot, { createIfMissing: true });
	const sessionId = resolveCliSessionId();
	const logger = await createProjectLogger({
		projectRoot: resolvedProjectRoot,
		config,
		sessionId,
	});
	return {
		projectRoot: resolvedProjectRoot,
		sessionId,
		config,
		logger,
		router: makeRouter(resolvedProjectRoot, config, logger, sessionId),
	};
};

export const loadCliPreviewContext = async (
	projectRoot = process.cwd(),
): Promise<InstallPreviewContext> => {
	const resolvedProjectRoot = process.env.MIMIRMESH_PROJECT_ROOT ?? projectRoot;

	try {
		const config = await readConfig(resolvedProjectRoot, { createIfMissing: false });
		return {
			projectRoot: resolvedProjectRoot,
			config,
		};
	} catch (error) {
		if (`${error}`.includes("ENOENT")) {
			return {
				projectRoot: resolvedProjectRoot,
				config: createDefaultConfig(resolvedProjectRoot),
			};
		}
		throw error;
	}
};

const pathExists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

const updateContextConfig = async (
	context: CliContext,
	update: (config: MimirmeshConfig) => MimirmeshConfig,
): Promise<CliContext> => {
	const nextConfig = update(context.config);
	await writeConfig(context.projectRoot, nextConfig);
	const nextLogger = await createProjectLogger({
		projectRoot: context.projectRoot,
		config: nextConfig,
		sessionId: context.logger.sessionId,
	});
	return {
		...context,
		config: nextConfig,
		logger: nextLogger,
		router: makeRouter(context.projectRoot, nextConfig, nextLogger, context.sessionId),
	};
};

export const initializeProject = async (
	context: CliContext,
): Promise<{
	analysis: RepositoryAnalysis;
	runtimeMessage: string;
	runtimeState: string;
	reports: string[];
	specKit: Awaited<ReturnType<typeof detectSpecKit>>;
}> => {
	await ensureProjectLayout(context.projectRoot);
	await setupProject(context);
	const files = await generateRuntimeFiles(context.projectRoot, context.config);
	await context.logger.log("runtime", "info", `Runtime files generated at ${files.composeFile}`);

	let specKit = await detectSpecKit(context.projectRoot);
	if (context.config.metadata.specKitExpected && !specKit.ready) {
		const initialized = await initializeSpecKit(context.projectRoot);
		specKit = initialized.status;
		await context.logger.log(
			"cli",
			"info",
			`Spec Kit initialized via ${initialized.installMode} for ${initialized.agent}`,
		);
	}

	await runtimeStart(context.projectRoot, context.config, context.logger);
	const analysis = await analyzeRepository(context.projectRoot);
	const reports = await generateAllReports(context.projectRoot, context.config);
	const finalStatus = await runtimeStatus(context.projectRoot, context.config);
	specKit = await detectSpecKit(context.projectRoot);

	const nextConfig = {
		...context.config,
		metadata: {
			...context.config.metadata,
			lastInitAt: new Date().toISOString(),
		},
	};
	await writeConfig(context.projectRoot, nextConfig);

	return {
		analysis,
		runtimeMessage: finalStatus.message,
		runtimeState: finalStatus.health.state,
		reports: reports.map((report) => report.path),
		specKit,
	};
};

export const refreshProject = async (
	context: CliContext,
): Promise<{
	runtimeMessage: string;
	reports: string[];
}> => {
	const status = await runtimeRefresh(context.projectRoot, context.config, context.logger);
	const reports = await generateAllReports(context.projectRoot, context.config);
	const nextConfig = {
		...context.config,
		metadata: {
			...context.config.metadata,
			lastRefreshAt: new Date().toISOString(),
		},
	};
	await writeConfig(context.projectRoot, nextConfig);
	return {
		runtimeMessage: status.message,
		reports: reports.map((report) => report.path),
	};
};

export const doctorProject = async (
	context: CliContext,
): Promise<{
	status: string;
	issues: string[];
}> => {
	const configValidation = await validateConfigFile(context.projectRoot);
	const runtime = await runtimeStatus(context.projectRoot, context.config);
	const issues: string[] = [];

	if (!configValidation.ok) {
		issues.push(...configValidation.errors);
	}
	if (runtime.health.degraded) {
		issues.push(...runtime.health.reasons);
	}
	if (!runtime.health.dockerInstalled) {
		issues.push("Install Docker Desktop or Docker Engine.");
	}
	if (!runtime.health.dockerDaemonRunning) {
		issues.push("Start the Docker daemon.");
	}

	const nextConfig = {
		...context.config,
		metadata: {
			...context.config.metadata,
			lastDoctorAt: new Date().toISOString(),
		},
	};
	await writeConfig(context.projectRoot, nextConfig);

	return {
		status: issues.length === 0 ? "healthy" : "issues-found",
		issues,
	};
};

export const configGet = async (context: CliContext, path: string): Promise<unknown> => {
	const result = await context.router.callTool("config_get", path ? { path } : {});
	const value = result.items[0]?.content ?? "";
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
};

export const configSet = async (
	context: CliContext,
	path: string,
	value: string,
): Promise<CliContext> => {
	if (path === "engines.enable") {
		return updateContextConfig(context, (config) => enableEngine(config, value as EngineId));
	}
	if (path === "engines.disable") {
		return updateContextConfig(context, (config) => disableEngine(config, value as EngineId));
	}
	const parsedValue = parseConfigPrimitive(value);
	return updateContextConfig(context, (config) => setConfigValue(config, path, parsedValue));
};

export const configEnableEngine = async (
	context: CliContext,
	engine: EngineId,
): Promise<CliContext> => updateContextConfig(context, (config) => enableEngine(config, engine));

export const configDisableEngine = async (
	context: CliContext,
	engine: EngineId,
): Promise<CliContext> => updateContextConfig(context, (config) => disableEngine(config, engine));

export const configValidate = async (context: CliContext) =>
	validateConfigFile(context.projectRoot);

export const runtimeAction = async (
	context: CliContext,
	action: "start" | "stop" | "restart" | "status" | "refresh",
) => {
	if (action === "start") {
		return runtimeStart(context.projectRoot, context.config, context.logger);
	}
	if (action === "stop") {
		return runtimeStop(context.projectRoot, context.config, context.logger);
	}
	if (action === "restart") {
		return runtimeRestart(context.projectRoot, context.config, context.logger);
	}
	if (action === "refresh") {
		return runtimeRefresh(context.projectRoot, context.config, context.logger);
	}
	return runtimeStatus(context.projectRoot, context.config);
};

export const runtimeUpgradeStatus = async (context: CliContext) =>
	classifyUpgradeStatus(context.projectRoot, context.config);

export const runtimeUpgradeMigrate = async (context: CliContext) =>
	migrateRuntime(context.projectRoot, context.config, context.logger);

export const runtimeUpgradeRepair = async (context: CliContext) =>
	repairRuntime(context.projectRoot, context.config, context.logger);

export const runtimeDoctor = async (context: CliContext) => {
	const status = await classifyUpgradeStatus(context.projectRoot, context.config);
	const validation = await validatePreservedAssets({
		projectRoot: context.projectRoot,
		assets: status.preservedAssets,
		quarantineInvalidAssets: false,
	});
	await persistRuntimeVersionEvidence(context.projectRoot, {
		generatedBy: "runtime-doctor",
		statusReport: status.report,
		preservedAssets: validation.assets,
		engineDecisions: status.engineDecisions,
		lastValidatedAt: new Date().toISOString(),
	});
	return {
		report: status.report,
		assets: validation.assets,
		warnings: validation.warnings,
	};
};

const notesDir = (projectRoot: string): string =>
	join(projectRoot, ".mimirmesh", "memory", "notes");

export const addNote = async (
	context: CliContext,
	title: string,
	content: string,
): Promise<{ path: string }> => {
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const path = join(
		notesDir(context.projectRoot),
		`${stamp}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`,
	);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `# ${title}\n\n${content.trim()}\n`, "utf8");
	return { path };
};

export const listNotes = async (context: CliContext): Promise<string[]> => {
	const directory = notesDir(context.projectRoot);
	await mkdir(directory, { recursive: true });
	const files = await readdir(directory);
	return files.sort().map((file) => join(directory, file));
};

export const searchNotes = async (context: CliContext, query: string): Promise<string[]> => {
	const hits = await searchInRepository(notesDir(context.projectRoot), query, { maxHits: 20 });
	return hits.map((hit) => `${hit.filePath}:${hit.line} ${hit.preview}`);
};

export const addDocument = async (
	context: CliContext,
	path: string,
): Promise<{ copiedTo: string }> => {
	const target = join(
		context.projectRoot,
		".mimirmesh",
		"memory",
		"documents",
		path.split("/").at(-1) ?? "doc",
	);
	await mkdir(dirname(target), { recursive: true });
	const source = await readFile(path);
	await writeFile(target, source);
	return {
		copiedTo: target,
	};
};

export const generateReports = async (context: CliContext): Promise<string[]> => {
	const reports = await generateAllReports(context.projectRoot, context.config);
	return reports.map((report) => report.path);
};

export const showReport = async (context: CliContext, name: string): Promise<string> => {
	const filePath = readReportPath(context.projectRoot, name);
	return readFile(filePath, "utf8");
};

export const installIde = async (
	context: CliContext,
	target: "vscode" | "cursor" | "claude" | "codex",
	serverCommand?: string,
): Promise<{
	configPath: string;
	serverCommand: string;
	serverArgs: string[];
}> => {
	const resolveExistingPath = async (candidate?: string | null): Promise<string | null> => {
		if (!candidate) {
			return null;
		}
		const resolved = resolve(candidate);
		return (await pathExists(resolved)) ? resolved : null;
	};
	const resolveInstallServer = async (): Promise<{ command: string; args: string[] }> => {
		if (serverCommand?.trim()) {
			return {
				command: serverCommand,
				args: [],
			};
		}

		const serverFromEnv = await resolveExistingPath(process.env.MIMIRMESH_SERVER_BIN);
		if (serverFromEnv) {
			return {
				command: serverFromEnv,
				args: [],
			};
		}

		// Prefer the local project build to avoid wiring IDEs to stale global binaries.
		const localDistServer = await resolveExistingPath(
			join(context.projectRoot, "dist", "mimirmesh-server"),
		);
		if (localDistServer) {
			return {
				command: localDistServer,
				args: [],
			};
		}

		const arg0 = process.argv[0] ? resolve(process.argv[0]) : "";
		const executableName = basename(arg0);
		const siblingServerBinary =
			executableName === "mimirmesh" || executableName === "mm"
				? await resolveExistingPath(join(dirname(arg0), "mimirmesh-server"))
				: null;
		if (siblingServerBinary) {
			return {
				command: siblingServerBinary,
				args: [],
			};
		}

		const serverFromPath = await resolveExistingPath(
			typeof Bun.which === "function" ? Bun.which("mimirmesh-server") : undefined,
		);
		if (serverFromPath) {
			return {
				command: serverFromPath,
				args: [],
			};
		}

		if ((executableName === "mimirmesh" || executableName === "mm") && (await pathExists(arg0))) {
			return {
				command: arg0,
				args: ["server"],
			};
		}

		const mimirmeshFromPath = await resolveExistingPath(
			typeof Bun.which === "function" ? Bun.which("mimirmesh") : undefined,
		);
		if (mimirmeshFromPath) {
			return {
				command: mimirmeshFromPath,
				args: ["server"],
			};
		}

		const serverSource = await resolveExistingPath(
			join(context.projectRoot, "apps", "server", "src", "index.ts"),
		);
		const bunBinary =
			(executableName === "bun" ? arg0 : null) ??
			(await resolveExistingPath(typeof Bun.which === "function" ? Bun.which("bun") : undefined));
		if (serverSource && bunBinary) {
			return {
				command: bunBinary,
				args: ["run", serverSource],
			};
		}

		return {
			command: "mimirmesh-server",
			args: [],
		};
	};

	const serverInvocation = await resolveInstallServer();
	const configPath = await installIdeConfig({
		projectRoot: context.projectRoot,
		target,
		serverCommand: serverInvocation.command,
		serverArgs: serverInvocation.args,
	});
	return {
		configPath,
		serverCommand: serverInvocation.command,
		serverArgs: serverInvocation.args,
	};
};

export const updateCheck = async (context: CliContext) => {
	const targetBinDir =
		process.env.MIMIRMESH_INSTALL_DIR ?? join(Bun.env.HOME ?? ".", ".local", "bin");
	return checkForUpdates(context.projectRoot, context.config.update.channel, {
		targetBinDir,
	});
};

export const applyUpdate = async (
	context: CliContext,
): Promise<{ applied: boolean; details: string }> =>
	performUpdate({
		projectRoot: context.projectRoot,
		targetBinDir: process.env.MIMIRMESH_INSTALL_DIR ?? join(Bun.env.HOME ?? ".", ".local", "bin"),
		artifactDir: join(context.projectRoot, "dist"),
		channel: context.config.update.channel,
	});

type SkillMaintenanceResult = {
	context: CliContext;
	configPath: string;
	guidance: Awaited<ReturnType<typeof ensureManagedAgentsSection>>;
	registryReadiness: string;
	registryStatePath: string;
	selectedProviderType: string | null;
	localRuntimeImage: string | null;
};

export const reconcileSkillMaintenanceState = async (
	context: CliContext,
	options: {
		presetId?: InstallPresetId;
		embeddings?: Partial<EmbeddingsInstallConfig>;
		selectedAreas?: InstallAreaId[];
	} = {},
): Promise<SkillMaintenanceResult> => {
	const nextSkillsConfig =
		options.presetId || options.embeddings || options.selectedAreas
			? mergeSkillInstallConfig(context.config.skills, {
					presetId: options.presetId,
					embeddings: options.embeddings,
					selectedAreas: options.selectedAreas,
				})
			: context.config.skills;
	const nextConfig = {
		...context.config,
		skills: nextSkillsConfig,
	};

	await writeSkillsConfig(context.projectRoot, context.config, nextSkillsConfig);

	const nextLogger = await createProjectLogger({
		projectRoot: context.projectRoot,
		config: nextConfig,
		sessionId: context.sessionId,
	});
	const nextContext = {
		...context,
		config: nextConfig,
		logger: nextLogger,
		router: makeRouter(context.projectRoot, nextConfig, nextLogger, context.sessionId),
	};

	const hostGpuCapability = await detectHostGpuCapability().catch(() => ({
		nvidiaRuntimeAvailable: false,
		reason: "GPU capability probe failed during skills maintenance sync.",
		platform: process.platform,
		arch: process.arch,
		supportedRuntimePlatform: false,
	}));
	const skillRegistry = await ensureSkillRegistryState(context.projectRoot, nextConfig, {
		hostGpuAvailable: hostGpuCapability.nvidiaRuntimeAvailable,
	});
	await generateRuntimeFiles(context.projectRoot, nextConfig);
	await runtimeRefresh(context.projectRoot, nextConfig, nextLogger);
	const guidance = await ensureManagedAgentsSection(context.projectRoot);

	return {
		context: nextContext,
		configPath: getConfigPath(context.projectRoot),
		guidance,
		registryReadiness: skillRegistry.readiness.state,
		registryStatePath: skillRegistry.readiness.statePath,
		selectedProviderType: skillRegistry.providerSelection.selectedProviderType,
		localRuntimeImage: skillRegistry.providerSelection.localRuntime?.image ?? null,
	};
};

const resolveSkillInstallMode = async (): Promise<SkillInstallMode> => {
	try {
		const globalConfig = await readGlobalConfig({ createIfMissing: false });
		return globalConfig.skills.install.symbolic ? "symlink" : "copy";
	} catch (error) {
		if (`${error}`.includes("ENOENT")) {
			return "symlink";
		}

		throw error;
	}
};

export const listSkills = async (
	context: CliContext,
): Promise<{
	mode: SkillInstallMode;
	skills: InstalledBundledSkill[];
}> => ({
	mode: await resolveSkillInstallMode(),
	skills: await listInstalledBundledSkills(context.projectRoot),
});

export const installSkills = async (
	context: CliContext,
	names: string[],
	options: {
		presetId?: InstallPresetId;
		embeddings?: Partial<EmbeddingsInstallConfig>;
		selectedAreas?: InstallAreaId[];
	} = {},
): Promise<{
	context: CliContext;
	mode: SkillInstallMode;
	installed: string[];
	skipped: string[];
	configPath: string;
	guidance: Awaited<ReturnType<typeof ensureManagedAgentsSection>>;
	registryReadiness: string;
	registryStatePath: string;
	selectedProviderType: string | null;
	localRuntimeImage: string | null;
}> => {
	const mode = await resolveSkillInstallMode();
	const result = await installBundledSkills({
		projectRoot: context.projectRoot,
		names,
		mode,
	});
	const maintenance = await reconcileSkillMaintenanceState(context, options);

	return {
		context: maintenance.context,
		mode,
		installed: result.installed,
		skipped: result.skipped,
		configPath: maintenance.configPath,
		guidance: maintenance.guidance,
		registryReadiness: maintenance.registryReadiness,
		registryStatePath: maintenance.registryStatePath,
		selectedProviderType: maintenance.selectedProviderType,
		localRuntimeImage: maintenance.localRuntimeImage,
	};
};

export const updateSkills = async (
	context: CliContext,
	names?: string[],
): Promise<{
	context: CliContext;
	mode: SkillInstallMode;
	updated: string[];
	skipped: string[];
	missing: string[];
	configPath: string;
	guidance: Awaited<ReturnType<typeof ensureManagedAgentsSection>>;
	registryReadiness: string;
	registryStatePath: string;
	selectedProviderType: string | null;
	localRuntimeImage: string | null;
}> => {
	const mode = await resolveSkillInstallMode();
	const result = await updateBundledSkills({
		projectRoot: context.projectRoot,
		names,
		mode,
	});
	const maintenance = await reconcileSkillMaintenanceState(context);

	return {
		context: maintenance.context,
		mode,
		updated: result.updated,
		skipped: result.skipped,
		missing: result.missing,
		configPath: maintenance.configPath,
		guidance: maintenance.guidance,
		registryReadiness: maintenance.registryReadiness,
		registryStatePath: maintenance.registryStatePath,
		selectedProviderType: maintenance.selectedProviderType,
		localRuntimeImage: maintenance.localRuntimeImage,
	};
};

export const removeSkills = async (
	context: CliContext,
	names: string[],
): Promise<{ removed: string[]; skipped: string[] }> =>
	removeBundledSkills({
		projectRoot: context.projectRoot,
		names,
	});

export const speckitStatus = async (context: CliContext) => detectSpecKit(context.projectRoot);

export const speckitInit = async (context: CliContext) => initializeSpecKit(context.projectRoot);

export const speckitDoctor = async (context: CliContext) => doctorSpecKit(context.projectRoot);

export const mcpListTools = async (context: CliContext) => context.router.listTools();

export const mcpInspectToolSurface = async (context: CliContext) =>
	context.router.inspectToolSurface();

export const mcpLoadDeferredTools = async (context: CliContext, engine: EngineId) =>
	context.router.loadDeferredToolGroup(engine, "explicit-load");

export const mcpInspectToolSchema = async (
	context: CliContext,
	toolName: string,
	view: "compressed" | "full" | "debug" = "full",
) => context.router.inspectToolSchema(toolName, view);

export const mcpCallTool = async (
	context: CliContext,
	tool: string,
	args: Record<string, unknown>,
) => context.router.callTool(tool as Parameters<ToolRouter["callTool"]>[0], args);

export const setupProject = async (context: CliContext): Promise<string[]> => {
	const directories = [
		join(context.projectRoot, "docs", "architecture"),
		join(context.projectRoot, "docs", "operations"),
		join(context.projectRoot, "docs", "runbooks"),
		join(context.projectRoot, "docs", "features"),
		join(context.projectRoot, "docs", "adr"),
		join(context.projectRoot, "docs", "specifications"),
	];
	for (const directory of directories) {
		await mkdir(directory, { recursive: true });
	}
	const guidancePath = join(context.projectRoot, "docs", "operations", "mimirmesh-guidance.md");
	if (!(await pathExists(guidancePath))) {
		await writeFile(
			guidancePath,
			"# MímirMesh Guidance\n\nUse `mimirmesh install` to initialize runtime, reports, bundled skills, and optional integrations.\n",
		);
	}
	return directories;
};

export const collectInitSignals = async (context: CliContext) => {
	const analysis = await analyzeRepository(context.projectRoot);
	const files = await collectRepositoryFiles(context.projectRoot);
	return {
		analysis,
		fileCount: files.length,
		configPath: getConfigPath(context.projectRoot),
	};
};

const installManagedPaths = (projectRoot: string) => ({
	core: [
		join(projectRoot, "docs", "architecture"),
		join(projectRoot, "docs", "operations", "mimirmesh-guidance.md"),
		join(projectRoot, "docs", "runbooks"),
		join(projectRoot, "docs", "features"),
		join(projectRoot, "docs", "adr"),
		join(projectRoot, "docs", "specifications"),
		join(projectRoot, ".mimirmesh", "reports", "project-summary.md"),
		join(projectRoot, ".mimirmesh", "runtime", "docker-compose.yml"),
		join(projectRoot, ".mimirmesh", "runtime", "routing-table.json"),
		join(projectRoot, ".mimirmesh", "runtime", "bootstrap-state.json"),
		join(projectRoot, ".mimirmesh", "runtime", "engines", "srclight.json"),
		join(projectRoot, ".specify", "scripts", "bash", "common.sh"),
	],
	ide: {
		vscode: join(projectRoot, ".vscode", "mcp.json"),
		cursor: join(projectRoot, ".cursor", "mcp.json"),
		claude: join(projectRoot, ".claude", "mcp.json"),
		codex: join(projectRoot, ".codex", "mcp.json"),
	},
	skillsRoot: join(projectRoot, ".agents", "skills"),
	skillsManaged: [
		getConfigPath(projectRoot),
		join(projectRoot, "AGENTS.md"),
		join(projectRoot, ".mimirmesh", "runtime", "skills-registry.json"),
	],
});

const classifyInstallArea = (options: {
	started: boolean;
	allReady: boolean;
	hasDegradedArtifact: boolean;
}): "completed" | "degraded" | "pending" => {
	if (options.allReady) {
		return "completed";
	}
	if (options.started || options.hasDegradedArtifact) {
		return "degraded";
	}
	return "pending";
};

const reportsGeneratedForPreview = async (projectRoot: string): Promise<boolean> => {
	const requiredReports = [
		"project-summary.md",
		"architecture.md",
		"deployment.md",
		"runtime-health.md",
		"speckit-status.md",
	];

	for (const report of requiredReports) {
		if (!(await pathExists(join(projectRoot, ".mimirmesh", "reports", report)))) {
			return false;
		}
	}

	return true;
};

const previewRuntimeStatus = async (
	context: InstallPreviewContext,
): Promise<{
	state: string;
	message: string;
	reasons: string[];
}> => {
	const availability = await detectDockerAvailability();
	const persistedHealth = await loadRuntimeHealth(context.projectRoot);

	if (
		!availability.dockerInstalled ||
		!availability.dockerDaemonRunning ||
		!availability.composeAvailable
	) {
		const health = buildRuntimeHealth({
			state: "failed",
			dockerInstalled: availability.dockerInstalled,
			dockerDaemonRunning: availability.dockerDaemonRunning,
			composeAvailable: availability.composeAvailable,
			reasons: availability.reasons,
			services: persistedHealth?.services ?? [],
			bridges: persistedHealth?.bridges ?? [],
			runtimeVersion: persistedHealth?.runtimeVersion ?? null,
			upgradeState: persistedHealth?.upgradeState ?? null,
			migrationStatus: persistedHealth?.migrationStatus ?? null,
		});

		return {
			state: health.state,
			message: "Runtime is unavailable until Docker and Compose are ready.",
			reasons: health.reasons,
		};
	}

	if (persistedHealth) {
		return {
			state: persistedHealth.state,
			message:
				persistedHealth.state === "ready"
					? "Runtime health checks passed."
					: "Runtime still needs attention.",
			reasons: persistedHealth.reasons,
		};
	}

	const [bootstrapState, routingTablePresent, hasRequiredReports] = await Promise.all([
		loadBootstrapState(context.projectRoot),
		loadRoutingTable(context.projectRoot).then((value) => value !== null),
		reportsGeneratedForPreview(context.projectRoot),
	]);

	const reasons: string[] = [];
	if (bootstrapState === null) {
		reasons.push("Bootstrap state is unavailable.");
	}
	if (!routingTablePresent) {
		reasons.push("Routing table has not been generated.");
	}
	if (!hasRequiredReports) {
		reasons.push("Required reports have not been generated.");
	}

	return {
		state: bootstrapState === null || !routingTablePresent ? "bootstrapping" : "degraded",
		message:
			bootstrapState === null || !routingTablePresent
				? "Runtime is bootstrapping."
				: "Runtime still needs attention.",
		reasons,
	};
};

export const detectInstallState = async (
	context: InstallPreviewContext,
): Promise<InstallationStateSnapshot> => {
	const paths = installManagedPaths(context.projectRoot);
	const coreArtifactStatuses = await Promise.all(
		paths.core.map(async (path) => ({
			areaId: "core" as const,
			path,
			status: (await pathExists(path)) ? ("present" as const) : ("missing" as const),
			requiresConfirmation:
				!path.endsWith("docs/architecture") &&
				!path.endsWith("docs/runbooks") &&
				!path.endsWith("docs/features") &&
				!path.endsWith("docs/adr") &&
				!path.endsWith("docs/specifications"),
		})),
	);
	const [specKit, runtime, skillStatuses, ideStatuses] = await Promise.all([
		detectSpecKit(context.projectRoot),
		previewRuntimeStatus(context),
		listInstalledBundledSkills(context.projectRoot),
		Promise.all(
			Object.entries(paths.ide).map(async ([target, path]) => ({
				target,
				path,
				exists: await pathExists(path),
			})),
		),
	]);

	const coreStarted =
		Boolean(context.config.metadata.lastInitAt) ||
		coreArtifactStatuses.some(
			(artifact) =>
				artifact.path.endsWith("project-summary.md") ||
				artifact.path.endsWith("bootstrap-state.json") ||
				artifact.path.endsWith("routing-table.json"),
		);
	const coreReady =
		coreArtifactStatuses.every((artifact) => artifact.status === "present") &&
		specKit.ready &&
		runtime.state === "ready";
	const coreState = classifyInstallArea({
		started: coreStarted,
		allReady: coreReady,
		hasDegradedArtifact: runtime.state !== "ready" || !specKit.ready,
	});

	const ideArtifacts = ideStatuses.map((status) => ({
		areaId: "ide" as const,
		path: status.path,
		status: status.exists ? ("present" as const) : ("missing" as const),
		detail: status.exists ? `Detected existing ${status.target} MCP configuration.` : undefined,
		requiresConfirmation: true,
	}));
	const ideState = classifyInstallArea({
		started: ideStatuses.some((status) => status.exists),
		allReady: ideStatuses.some((status) => status.exists),
		hasDegradedArtifact: false,
	});

	const skillArtifacts = skillStatuses.map((status) => ({
		areaId: "skills" as const,
		path: join(paths.skillsRoot, status.name, "SKILL.md"),
		status: !status.installed
			? ("missing" as const)
			: status.outdated || status.broken
				? ("degraded" as const)
				: ("present" as const),
		detail: status.broken
			? `${status.name} is installed but broken.`
			: status.outdated
				? `${status.name} is installed but outdated.`
				: status.installed
					? `${status.name} is already installed.`
					: undefined,
		requiresConfirmation: true,
	}));
	const skillManagedArtifacts = await Promise.all(
		paths.skillsManaged.map(async (path) => ({
			areaId: "skills" as const,
			path,
			status: (await pathExists(path)) ? ("present" as const) : ("missing" as const),
			requiresConfirmation: true,
		})),
	);
	const skillsState = classifyInstallArea({
		started: skillStatuses.some((status) => status.installed),
		allReady:
			skillStatuses.length > 0 &&
			skillStatuses.every((status) => status.installed && !status.outdated && !status.broken),
		hasDegradedArtifact: skillStatuses.some((status) => status.outdated || status.broken),
	});

	return createInstallationStateSnapshot({
		projectRoot: context.projectRoot,
		completedAreas: [
			...(coreState === "completed" ? (["core"] as const) : []),
			...(ideState === "completed" ? (["ide"] as const) : []),
			...(skillsState === "completed" ? (["skills"] as const) : []),
		],
		degradedAreas: [
			...(coreState === "degraded" ? (["core"] as const) : []),
			...(ideState === "degraded" ? (["ide"] as const) : []),
			...(skillsState === "degraded" ? (["skills"] as const) : []),
		],
		pendingAreas: [
			...(coreState === "pending" ? (["core"] as const) : []),
			...(ideState === "pending" ? (["ide"] as const) : []),
			...(skillsState === "pending" ? (["skills"] as const) : []),
		],
		detectedArtifacts: [
			...coreArtifactStatuses,
			...ideArtifacts,
			...skillArtifacts,
			...skillManagedArtifacts,
		],
		specKitStatus: {
			ready: specKit.ready,
			details: specKit.ready ? "Spec Kit ready." : "Spec Kit bootstrap still required.",
		},
		runtimeStatus: {
			state: runtime.state,
			message: runtime.message,
			reasons: runtime.reasons,
		},
	});
};

const filterArtifactsForPolicy = (
	snapshot: InstallationStateSnapshot,
	policy: InstallationPolicy,
): InstallationStateSnapshot => {
	const filteredArtifacts = snapshot.detectedArtifacts.filter((artifact) => {
		if (!policy.selectedAreas.includes(artifact.areaId)) {
			return false;
		}

		if (artifact.areaId === "ide") {
			if (policy.ideTargets.length === 0) {
				return false;
			}
			const selectedPaths = policy.ideTargets.map(
				(target) => installManagedPaths(snapshot.projectRoot).ide[target],
			);
			return selectedPaths.includes(artifact.path);
		}

		if (artifact.areaId === "skills") {
			const selectedSkillNames =
				policy.selectedSkills.length > 0 ? policy.selectedSkills : [...bundledSkillNames];
			return selectedSkillNames.some((name) =>
				artifact.path.includes(join(".agents", "skills", name)),
			);
		}

		return true;
	});

	return {
		...snapshot,
		detectedArtifacts: filteredArtifacts,
	};
};

export const previewInstallExecution = async (
	context: InstallPreviewContext,
	policy: InstallationPolicy,
): Promise<{
	snapshot: InstallationStateSnapshot;
	summary: InstallChangeSummary;
	skillStatuses: InstalledBundledSkill[];
}> => {
	const [snapshot, skillStatuses] = await Promise.all([
		detectInstallState(context),
		listInstalledBundledSkills(context.projectRoot),
	]);
	const scopedSnapshot = filterArtifactsForPolicy(snapshot, policy);
	return {
		snapshot,
		summary: buildInstallChangeSummary(policy, scopedSnapshot),
		skillStatuses,
	};
};

export const collectDashboardSnapshot = async (projectRoot?: string) => {
	const context = await loadCliContext(projectRoot);
	const [initSignals, configValidation, runtime, upgrade, tools, installState] = await Promise.all([
		collectInitSignals(context),
		configValidate(context),
		runtimeAction(context, "status"),
		runtimeUpgradeStatus(context),
		mcpListTools(context),
		detectInstallState(context),
	]);

	return {
		context,
		initSignals,
		installState,
		configValidation,
		runtime,
		upgrade,
		tools,
	};
};
