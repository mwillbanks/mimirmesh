import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import {
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
} from "@mimirmesh/config";
import { checkForUpdates, installIdeConfig, performUpdate } from "@mimirmesh/installer";
import { createProjectLogger, type ProjectLogger } from "@mimirmesh/logging";
import { createAdapters } from "@mimirmesh/mcp-adapters";
import { createToolRouter, type ToolRouter } from "@mimirmesh/mcp-core";
import { generateAllReports, readReportPath } from "@mimirmesh/reports";
import {
	classifyUpgradeStatus,
	ensureProjectLayout,
	generateRuntimeFiles,
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
	config: MimirmeshConfig;
	logger: ProjectLogger;
	router: ToolRouter;
};

const makeRouter = (
	projectRoot: string,
	config: MimirmeshConfig,
	logger: ProjectLogger,
): ToolRouter => {
	const adapters = createAdapters(config);
	return createToolRouter({
		projectRoot,
		config,
		adapters,
		logger,
	});
};

export const loadCliContext = async (projectRoot = process.cwd()): Promise<CliContext> => {
	const resolvedProjectRoot = process.env.MIMIRMESH_PROJECT_ROOT ?? projectRoot;
	await ensureProjectLayout(resolvedProjectRoot);
	const config = await readConfig(resolvedProjectRoot, { createIfMissing: true });
	const logger = await createProjectLogger({
		projectRoot: resolvedProjectRoot,
		config,
		sessionId: process.env.MIMIRMESH_SESSION_ID,
	});
	const router = makeRouter(resolvedProjectRoot, config, logger);
	return {
		projectRoot: resolvedProjectRoot,
		config,
		logger,
		router,
	};
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
		router: makeRouter(context.projectRoot, nextConfig, nextLogger),
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
	const pathExists = async (path: string): Promise<boolean> => {
		try {
			await access(path);
			return true;
		} catch {
			return false;
		}
	};
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

		const serverFromPath = await resolveExistingPath(
			typeof Bun.which === "function" ? Bun.which("mimirmesh-server") : undefined,
		);
		if (serverFromPath) {
			return {
				command: serverFromPath,
				args: [],
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
			command: "mimirmesh",
			args: ["server"],
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
): Promise<{
	mode: SkillInstallMode;
	installed: string[];
	skipped: string[];
}> => {
	const mode = await resolveSkillInstallMode();
	const result = await installBundledSkills({
		projectRoot: context.projectRoot,
		names,
		mode,
	});

	return {
		mode,
		installed: result.installed,
		skipped: result.skipped,
	};
};

export const updateSkills = async (
	context: CliContext,
	names?: string[],
): Promise<{
	mode: SkillInstallMode;
	updated: string[];
	skipped: string[];
	missing: string[];
}> => {
	const mode = await resolveSkillInstallMode();
	const result = await updateBundledSkills({
		projectRoot: context.projectRoot,
		names,
		mode,
	});

	return {
		mode,
		updated: result.updated,
		skipped: result.skipped,
		missing: result.missing,
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
		join(context.projectRoot, "docs", "decisions"),
		join(context.projectRoot, "docs", "specifications"),
	];
	for (const directory of directories) {
		await mkdir(directory, { recursive: true });
	}
	const guidancePath = join(context.projectRoot, "docs", "operations", "mimirmesh-guidance.md");
	await writeFile(
		guidancePath,
		"# MímirMesh Guidance\n\nUse `mimirmesh init` to initialize runtime and reports.\n",
		{
			flag: "a+",
		},
	);
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

export const collectDashboardSnapshot = async (projectRoot?: string) => {
	const context = await loadCliContext(projectRoot);
	const [initSignals, configValidation, runtime, upgrade, tools] = await Promise.all([
		collectInitSignals(context),
		configValidate(context),
		runtimeAction(context, "status"),
		runtimeUpgradeStatus(context),
		mcpListTools(context),
	]);

	return {
		context,
		initSignals,
		configValidation,
		runtime,
		upgrade,
		tools,
	};
};
