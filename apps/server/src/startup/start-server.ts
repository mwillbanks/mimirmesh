import { access } from "node:fs/promises";
import { join } from "node:path";

import { readConfig } from "@mimirmesh/config";
import { createProjectLogger, type ProjectLogger } from "@mimirmesh/logging";
import { createAdapters } from "@mimirmesh/mcp-adapters";
import {
	buildRetiredPassthroughAliasResult,
	createToolRouter,
	isUnifiedTool,
	loadRuntimeRoutingContext,
	type ToolInput,
	type ToolName,
	unifiedToolInputSchemas,
} from "@mimirmesh/mcp-core";
import {
	clearMcpServerSession,
	closeAllSharedSqlClients,
	loadExecutableBuildManifest,
	openRouteTelemetryStore,
	persistMcpServerSession,
	ROUTE_TELEMETRY_COMPACTION_CADENCE_MINUTES,
	runRouteTelemetryMaintenance,
	summarizeRouteTelemetryHealth,
} from "@mimirmesh/runtime";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type {
	AnySchema as McpAnySchema,
	ZodRawShapeCompat,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { CallToolRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { toTransportToolName } from "../middleware/tool-name";
import { filterPassthroughTools } from "../tools/passthrough";
import { filterUnifiedTools, missingRequiredStartupUnifiedTools } from "../tools/unified";

const resolveVersion = async (): Promise<string> => {
	const candidates = [
		join(process.cwd(), "package.json"),
		join(import.meta.dir, "..", "..", "..", "package.json"),
	];
	for (const candidate of candidates) {
		try {
			await access(candidate);
			const packageJson = (await Bun.file(candidate).json()) as { version?: string };
			if (packageJson.version) {
				return packageJson.version;
			}
		} catch {
			// ignore and continue
		}
	}
	return process.env.MIMIRMESH_VERSION ?? "1.0.0";
};

type RegisteredToolHandle = {
	enabled: boolean;
	inputSchema?: {
		safeParseAsync: (value: unknown) => Promise<{
			success: boolean;
			data?: Record<string, unknown>;
			error?: {
				message: string;
			};
		}>;
	};
	handler: (input: Record<string, unknown>, extra?: unknown) => Promise<TransportToolResult>;
	disable: () => void;
	enable: () => void;
};

type TransportToolResult = {
	content: Array<{
		type: "text";
		text: string;
	}>;
	structuredContent?: Record<string, unknown>;
	isError?: boolean;
};

const leanSkillsTransportSchemas = {
	"skills.find": z.object({
		query: z.string().trim().min(1).optional(),
		names: z.array(z.string().trim().min(1)).optional(),
		include: z
			.array(
				z.enum([
					"description",
					"contentHash",
					"capabilities",
					"assetCounts",
					"compatibility",
					"summary",
					"matchReason",
				]),
			)
			.optional(),
		limit: z.number().int().positive().optional(),
		offset: z.number().int().min(0).optional(),
	}),
	"skills.read": z.object({
		name: z.string().trim().min(1),
		mode: z.enum(["memory", "instructions", "assets", "full"]).optional(),
		include: z
			.array(
				z.enum([
					"description",
					"metadata",
					"instructions",
					"sectionIndex",
					"referencesIndex",
					"scriptsIndex",
					"templatesIndex",
					"examplesIndex",
					"auxiliaryIndex",
					"references",
					"scripts",
					"templates",
					"examples",
					"auxiliary",
					"fullText",
				]),
			)
			.optional(),
		select: z
			.object({
				sections: z.array(z.string()).optional(),
				references: z.array(z.string()).optional(),
				scripts: z.array(z.string()).optional(),
				templates: z.array(z.string()).optional(),
				examples: z.array(z.string()).optional(),
				auxiliary: z.array(z.string()).optional(),
			})
			.optional(),
	}),
	"skills.resolve": z.object({
		prompt: z.string().trim().min(1),
		taskMetadata: z.record(z.string(), z.unknown()).optional(),
		mcpEngineContext: z.record(z.string(), z.unknown()).optional(),
		include: z.array(z.enum(["matchReason", "score", "configInfluence", "readHint"])).optional(),
		limit: z.number().int().positive().optional(),
	}),
	"skills.refresh": z.object({
		names: z.array(z.string().trim().min(1)).optional(),
		scope: z.enum(["repo", "all"]).optional(),
		invalidateNotFound: z.boolean().optional(),
		reindexEmbeddings: z.boolean().optional(),
	}),
	"skills.create": z.object({
		prompt: z.string().trim().min(1),
		targetPath: z.string().trim().min(1).optional(),
		template: z.string().trim().min(1).optional(),
		mode: z.enum(["analyze", "generate", "write"]).optional(),
		includeRecommendations: z.boolean().optional(),
		includeGapAnalysis: z.boolean().optional(),
		includeCompletenessAnalysis: z.boolean().optional(),
		includeConsistencyAnalysis: z.boolean().optional(),
		validateBeforeWrite: z.boolean().optional(),
	}),
	"skills.update": z.object({
		name: z.string().trim().min(1),
		prompt: z.string().trim().min(1),
		mode: z.enum(["analyze", "patchPlan", "write"]).optional(),
		includeRecommendations: z.boolean().optional(),
		includeGapAnalysis: z.boolean().optional(),
		includeCompletenessAnalysis: z.boolean().optional(),
		includeConsistencyAnalysis: z.boolean().optional(),
		validateBeforeWrite: z.boolean().optional(),
		validateAfterWrite: z.boolean().optional(),
	}),
} as const;

const resolveTransportInputSchema = (
	toolName: ToolName,
	passthroughSchema: McpAnySchema | z.ZodTypeAny,
): McpAnySchema | ZodRawShapeCompat => {
	if (!isUnifiedTool(toolName)) {
		return passthroughSchema as McpAnySchema;
	}

	if (toolName in leanSkillsTransportSchemas) {
		return leanSkillsTransportSchemas[toolName as keyof typeof leanSkillsTransportSchemas]
			.shape as unknown as ZodRawShapeCompat;
	}

	return unifiedToolInputSchemas[toolName] as unknown as ZodRawShapeCompat;
};

const buildTransportStructuredContent = (
	toolName: string,
	result: {
		tool: string;
		success: boolean;
		degraded: boolean;
		warnings: string[];
		warningCodes: string[];
		nextAction?: string;
		raw?: Record<string, unknown>;
	},
): Record<string, unknown> =>
	toolName.startsWith("skills.")
		? {
				tool: result.tool,
				success: result.success,
				degraded: result.degraded,
				warnings: result.warnings,
				warningCodes: result.warningCodes,
				...(result.nextAction ? { nextAction: result.nextAction } : {}),
				data: result.raw ?? {},
			}
		: {
				result,
			};

export const startRouteTelemetryMaintenanceLoop = async (options: {
	projectRoot: string;
	config: Awaited<ReturnType<typeof readConfig>>;
	sessionId: string;
	logger: Pick<ProjectLogger, "log">;
	loadRuntimeContext?: typeof loadRuntimeRoutingContext;
	openStore?: typeof openRouteTelemetryStore;
	runMaintenance?: typeof runRouteTelemetryMaintenance;
	cadenceMs?: number;
}) => {
	const loadRuntimeContext = options.loadRuntimeContext ?? loadRuntimeRoutingContext;
	const openStore = options.openStore ?? openRouteTelemetryStore;
	const runMaintenance = options.runMaintenance ?? runRouteTelemetryMaintenance;
	const cadenceMs = options.cadenceMs ?? ROUTE_TELEMETRY_COMPACTION_CADENCE_MINUTES * 60 * 1000;
	const runtime = await loadRuntimeContext(options.projectRoot);
	if (!runtime.connection?.services.includes("mm-postgres")) {
		return async () => {};
	}
	const store = await openStore(options.projectRoot, options.config);
	if (!store) {
		await options.logger.log(
			"mcp",
			"warn",
			"Route telemetry maintenance loop unavailable because runtime PostgreSQL could not be opened.",
		);
		return async () => {};
	}

	let stopped = false;
	let timer: ReturnType<typeof setInterval> | null = null;
	let inFlight: Promise<void> | null = null;
	const runOnce = async (trigger: "startup" | "interval") => {
		if (stopped || inFlight) {
			return;
		}
		inFlight = (async () => {
			const maintenanceState = await store.loadMaintenanceState();
			const summary = summarizeRouteTelemetryHealth({ maintenanceState });
			const shouldRun =
				trigger === "interval" ||
				summary.lastSuccessfulCompactionAt === null ||
				summary.maintenanceStatus.overdueBySeconds > 0;
			if (!shouldRun) {
				return;
			}
			try {
				const result = await runMaintenance({
					store,
					lockOwner: `mcp-server:${options.sessionId}`,
				});
				if (result.acquired) {
					await options.logger.log(
						"mcp",
						"info",
						`Route telemetry maintenance ${trigger} completed with ${result.progress.closedBucketCount} closed bucket(s).`,
					);
					return;
				}
				await options.logger.log(
					"mcp",
					"warn",
					`Route telemetry maintenance ${trigger} skipped because another maintainer holds the advisory lock.`,
				);
			} catch (error) {
				await options.logger.log(
					"mcp",
					"warn",
					`Route telemetry maintenance ${trigger} failed: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		})().finally(() => {
			inFlight = null;
		});
		await inFlight;
	};

	void runOnce("startup");
	timer = setInterval(() => {
		void runOnce("interval");
	}, cadenceMs);
	timer.unref?.();

	return async () => {
		stopped = true;
		if (timer) {
			clearInterval(timer);
		}
		if (inFlight) {
			await inFlight;
		}
		await store.close();
	};
};

export const startMcpServer = async (projectRootInput?: string): Promise<void> => {
	const projectRoot = projectRootInput ?? process.env.MIMIRMESH_PROJECT_ROOT ?? process.cwd();
	const sessionId = process.env.MIMIRMESH_SESSION_ID ?? `mcp-${process.pid}`;
	const version = await resolveVersion();
	const config = await readConfig(projectRoot, { createIfMissing: true });
	const logger = await createProjectLogger({
		projectRoot,
		config,
		sessionId: process.env.MIMIRMESH_SESSION_ID,
	});

	await logger.log("mcp", "info", `Starting MímirMesh MCP server in ${projectRoot}`);
	const executableBuild = await loadExecutableBuildManifest(projectRoot);
	if (executableBuild) {
		await persistMcpServerSession(projectRoot, {
			pid: process.pid,
			sessionId,
			startedAt: new Date().toISOString(),
			version: executableBuild.manifest.version,
			builtAt: executableBuild.manifest.builtAt,
			buildId: executableBuild.manifest.buildId,
			executablePath: process.execPath,
			manifestPath: executableBuild.path,
		});
	}

	const adapters = createAdapters(config);
	const router = createToolRouter({
		projectRoot,
		config,
		sessionId,
		adapters,
		logger,
	});

	const server = new McpServer({
		name: "mimirmesh",
		version,
	});
	const registeredTools = new Map<
		string,
		{
			allowDisabledCall: boolean;
			tool: RegisteredToolHandle;
		}
	>();
	const registerTransportTool = (
		name: string,
		options: {
			title: string;
			description?: string;
			inputSchema: McpAnySchema | ZodRawShapeCompat;
		},
		handler: (input: ToolInput, extra?: unknown) => Promise<TransportToolResult>,
		settings: {
			allowDisabledCall?: boolean;
			disable?: boolean;
		} = {},
	) => {
		const tool = server.registerTool(
			name,
			options,
			handler as never,
		) as unknown as RegisteredToolHandle;
		if (settings.disable) {
			tool.disable();
		}
		registeredTools.set(name, {
			allowDisabledCall: settings.allowDisabledCall ?? false,
			tool,
		});
		return tool;
	};
	const invokeRegisteredTool = async (
		name: string,
		argumentsInput: Record<string, unknown>,
	): Promise<TransportToolResult> => {
		const entry = registeredTools.get(name);
		if (!entry) {
			throw new McpError(ErrorCode.InvalidParams, `Tool ${name} not found`);
		}
		if (!entry.tool.enabled && !entry.allowDisabledCall) {
			throw new McpError(ErrorCode.InvalidParams, `Tool ${name} disabled`);
		}
		if (entry.tool.inputSchema) {
			const parsed = await entry.tool.inputSchema.safeParseAsync(argumentsInput);
			if (!parsed.success) {
				throw new McpError(
					ErrorCode.InvalidParams,
					`Invalid arguments for tool ${name}: ${parsed.error?.message ?? "unknown error"}`,
				);
			}
			return entry.tool.handler(parsed.data ?? {});
		}
		return entry.tool.handler(argumentsInput);
	};

	const passthroughSchema = z.object({}).passthrough();
	const toolDefinitions = await router.listTools();
	const runtime = await loadRuntimeRoutingContext(projectRoot);
	const retiredAliases = (runtime.routing?.passthrough ?? []).flatMap((route) => {
		const aliases = route.publication?.retiredAliases ?? [];
		const replacementName = route.publication?.publishedTool ?? route.publicTool;
		return aliases.map((alias) => ({
			alias,
			replacementName,
			route,
		}));
	});
	await logger.log(
		"mcp",
		"info",
		`Registering ${filterUnifiedTools(toolDefinitions).length} unified and ${filterPassthroughTools(toolDefinitions).length} visible passthrough tools`,
	);
	const missingStartupTools = missingRequiredStartupUnifiedTools(toolDefinitions);
	if (missingStartupTools.length > 0) {
		await logger.log(
			"mcp",
			"warn",
			`Missing required startup unified tools: ${missingStartupTools.join(", ")}`,
		);
	}

	for (const tool of toolDefinitions) {
		const transportToolName = toTransportToolName(tool.name);
		const inputSchema = resolveTransportInputSchema(tool.name as ToolName, passthroughSchema);

		registerTransportTool(
			transportToolName,
			{
				title: transportToolName,
				description: tool.description,
				inputSchema,
			},
			async (input: ToolInput) => {
				const result = await router.callTool(
					tool.name as ToolName,
					input as Record<string, unknown>,
				);
				await logger.log(
					"mcp",
					result.success ? "info" : "warn",
					`${tool.name} -> ${result.message}`,
				);
				return {
					content: [
						{
							type: "text" as const,
							text: result.message,
						},
					],
					structuredContent: buildTransportStructuredContent(tool.name, result),
					isError: !result.success,
				};
			},
		);
	}

	const syncPassthroughVisibility = async (): Promise<void> => {
		const [visibleTools, nextRuntime] = await Promise.all([
			router.listTools(),
			loadRuntimeRoutingContext(projectRoot),
		]);
		const visibleTransportNames = new Set(
			filterPassthroughTools(visibleTools).map((tool) => toTransportToolName(tool.name)),
		);

		for (const route of nextRuntime.routing?.passthrough ?? []) {
			const publishedName = toTransportToolName(
				route.publication?.publishedTool ?? route.publicTool,
			);
			if (!registeredTools.has(publishedName)) {
				registerTransportTool(
					publishedName,
					{
						title: publishedName,
						description: route.description ?? `${route.engine}.${route.engineTool}`,
						inputSchema: passthroughSchema as unknown as McpAnySchema,
					},
					async (input: ToolInput) => {
						const result = await router.callTool(
							(route.publication?.publishedTool ?? route.publicTool) as ToolName,
							input as Record<string, unknown>,
						);
						return {
							content: [{ type: "text" as const, text: result.message }],
							structuredContent: { result },
							isError: !result.success,
						};
					},
					{ disable: !visibleTransportNames.has(publishedName) },
				);
			}

			const handle = registeredTools.get(publishedName);
			if (!handle) {
				continue;
			}
			if (visibleTransportNames.has(publishedName)) {
				handle.tool.enable();
			} else {
				handle.tool.disable();
			}
		}
	};

	await syncPassthroughVisibility();

	for (const alias of retiredAliases) {
		const transportToolName = toTransportToolName(alias.alias);
		registerTransportTool(
			transportToolName,
			{
				title: transportToolName,
				description: `Retired passthrough alias for ${alias.replacementName}`,
				inputSchema: passthroughSchema as unknown as McpAnySchema,
			},
			async () => {
				const result = buildRetiredPassthroughAliasResult({
					requestedAlias: alias.alias,
					route: alias.route,
					replacementName: alias.replacementName,
				});
				await logger.log("mcp", "warn", result.message);
				return {
					content: [
						{
							type: "text" as const,
							text: result.message,
						},
					],
					structuredContent: {
						result,
					},
					isError: true,
				};
			},
			{ allowDisabledCall: true, disable: true },
		);
	}

	server.server.setRequestHandler(CallToolRequestSchema, async (request) =>
		(async () => {
			const result = await invokeRegisteredTool(
				request.params.name,
				(request.params.arguments ?? {}) as Record<string, unknown>,
			);
			if (
				request.params.name === "load_deferred_tools" ||
				request.params.name === "refresh_tool_surface"
			) {
				await syncPassthroughVisibility();
				await router.markToolSurfaceNotified();
				server.sendToolListChanged();
			}
			return result;
		})(),
	);

	const transport = new StdioServerTransport();
	await server.connect(transport);
	await logger.log("mcp", "info", "MCP server connected over stdio.");
	const stopRouteTelemetryMaintenance = await startRouteTelemetryMaintenanceLoop({
		projectRoot,
		config,
		sessionId,
		logger,
	});

	const closeServer = async () => {
		await logger.log("mcp", "info", "Shutting down MCP server.");
		await stopRouteTelemetryMaintenance();
		await closeAllSharedSqlClients();
		await clearMcpServerSession(projectRoot, process.pid);
		await server.close();
		process.exit(0);
	};

	process.on("SIGINT", closeServer);
	process.on("SIGTERM", closeServer);
};
