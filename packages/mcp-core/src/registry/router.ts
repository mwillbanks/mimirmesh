import { relative } from "node:path";

import {
	disableEngine,
	type EngineId,
	enableEngine,
	getConfigValue,
	type MimirmeshConfig,
	parseConfigPrimitive,
	setConfigValue,
	writeConfig,
} from "@mimirmesh/config";
import { getAdapter } from "@mimirmesh/mcp-adapters";
import {
	classifyUpgradeStatus,
	detectMcpServerStaleness,
	loadEngineState,
	runtimeStatus,
} from "@mimirmesh/runtime";
import { loadRepositoryIgnoreMatcher } from "@mimirmesh/workspace";

import { loadRuntimeRoutingContext } from "../discovery/runtime";
import { deduplicateAndRank } from "../merge/results";
import { normalizeEnginePayloadPaths, translateEngineToolInput } from "../paths/translation";
import { passthroughRouteFor, unifiedRoutesFor } from "../routing/table";
import { invokeEngineTool } from "../transport/bridge";
import type {
	MiddlewareContext,
	NormalizedToolResult,
	ToolDefinition,
	ToolInput,
	ToolName,
	ToolProvenance,
	ToolResultItem,
	ToolRouterOptions,
	ToolWarningCode,
	UnifiedToolName,
} from "../types";
import { applyMiddleware, errorNormalizationMiddleware, timingMiddleware } from "./middleware";
import {
	isUnifiedTool,
	unifiedToolDescriptions,
	unifiedToolInputSchemas,
	unifiedToolList,
} from "./unified";

const nowId = (prefix: string): string =>
	`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const normalizePath = (value: string): string => value.replaceAll("\\", "/");

const repositoryPathKeys = [
	"filePath",
	"file_path",
	"path",
	"file",
	"source",
	"uri",
	"location",
] as const;

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const toRepositoryRelativePath = (projectRoot: string, candidatePath: string): string | null => {
	const normalized = normalizePath(candidatePath.trim());
	if (!normalized || normalized.startsWith("http://") || normalized.startsWith("https://")) {
		return null;
	}
	if (normalized.startsWith("file://")) {
		return null;
	}
	if (normalized.startsWith("/")) {
		const relativePath = normalizePath(relative(projectRoot, normalized));
		if (relativePath.startsWith("../") || relativePath === "..") {
			return null;
		}
		return relativePath.replace(/^\.\/+/, "");
	}
	return normalized.replace(/^\.\/+/, "").replace(/^\/+/, "");
};

const recordHasIgnoredPath = (
	record: Record<string, unknown>,
	projectRoot: string,
	matcher: Awaited<ReturnType<typeof loadRepositoryIgnoreMatcher>>,
): boolean => {
	for (const key of repositoryPathKeys) {
		const value = record[key];
		if (typeof value !== "string") {
			continue;
		}

		const relativePath = toRepositoryRelativePath(projectRoot, value);
		if (relativePath && matcher.ignores(relativePath)) {
			return true;
		}
	}

	return false;
};

const filterIgnoredPayload = (
	payload: unknown,
	projectRoot: string,
	matcher: Awaited<ReturnType<typeof loadRepositoryIgnoreMatcher>>,
): unknown => {
	if (Array.isArray(payload)) {
		return payload
			.map((entry) => filterIgnoredPayload(entry, projectRoot, matcher))
			.filter((entry) => entry !== undefined);
	}

	const record = asRecord(payload);
	if (!record) {
		return payload;
	}
	if (recordHasIgnoredPath(record, projectRoot, matcher)) {
		return undefined;
	}
	if (Array.isArray(record.content)) {
		const parsedEnvelope = parseJsonEnvelope(extractTextContent(record));
		if (parsedEnvelope !== null) {
			return filterIgnoredPayload(parsedEnvelope, projectRoot, matcher);
		}
	}

	const filteredEntries = Object.entries(record).map(
		([key, value]) => [key, filterIgnoredPayload(value, projectRoot, matcher)] as const,
	);

	return Object.fromEntries(filteredEntries.filter(([, value]) => value !== undefined));
};

const toResultItems = (engine: string, tool: string, payload: unknown): ToolResultItem[] => {
	if (Array.isArray(payload)) {
		return payload.map((entry, index) => ({
			id: nowId("arr"),
			title: `${engine}.${tool}[${index}]`,
			content: typeof entry === "string" ? entry : JSON.stringify(entry, null, 2),
			score: 60,
			metadata: {
				engine,
				tool,
				index,
			},
		}));
	}

	if (typeof payload === "object" && payload !== null) {
		const asRecord = payload as Record<string, unknown>;

		if (typeof asRecord.result === "object" && asRecord.result !== null) {
			return toResultItems(engine, tool, asRecord.result);
		}

		if (Array.isArray(asRecord.results)) {
			return toResultItems(engine, tool, asRecord.results);
		}

		if (Array.isArray(asRecord.matches)) {
			return toResultItems(engine, tool, asRecord.matches);
		}

		if (Array.isArray(asRecord.content)) {
			const text = asRecord.content
				.map((part) =>
					typeof part === "object" && part !== null
						? String((part as { text?: unknown }).text ?? "")
						: "",
				)
				.filter(Boolean)
				.join("\n");
			return [
				{
					id: nowId("content"),
					title: `${engine}.${tool}`,
					content: text || JSON.stringify(payload, null, 2),
					score: 70,
					metadata: { engine, tool },
				},
			];
		}

		return [
			{
				id: nowId("obj"),
				title: `${engine}.${tool}`,
				content: JSON.stringify(payload, null, 2),
				score: 65,
				metadata: { engine, tool },
			},
		];
	}

	return [
		{
			id: nowId("val"),
			title: `${engine}.${tool}`,
			content: String(payload),
			score: 55,
			metadata: { engine, tool },
		},
	];
};

const normalizeWarnings = (warnings: Array<string | undefined | null>): string[] =>
	warnings.filter((warning): warning is string => Boolean(warning?.trim()));

const normalizeWarningCodes = (
	codes: Array<ToolWarningCode | undefined | null>,
): ToolWarningCode[] => [
	...new Set(codes.filter((code): code is ToolWarningCode => Boolean(code))),
];

const requiredFieldsForSchema = (inputSchema: Record<string, unknown> | undefined): string[] => {
	const required = inputSchema?.required;
	return Array.isArray(required)
		? required.filter((field): field is string => typeof field === "string" && field.length > 0)
		: [];
};

const missingRequiredFields = (
	inputSchema: Record<string, unknown> | undefined,
	input: Record<string, unknown>,
): string[] =>
	requiredFieldsForSchema(inputSchema).filter((field) => {
		const value = input[field];
		if (value === null || value === undefined) {
			return true;
		}
		if (typeof value === "string") {
			return value.trim().length === 0;
		}
		if (Array.isArray(value)) {
			return value.length === 0;
		}
		return false;
	});

const extractTextContent = (payload: unknown): string => {
	if (typeof payload === "string") {
		return payload;
	}

	const record = asRecord(payload);
	if (!record) {
		return "";
	}

	if (Array.isArray(record.content)) {
		return record.content
			.map((part) =>
				typeof part === "object" && part !== null
					? String((part as { text?: unknown }).text ?? "")
					: "",
			)
			.filter(Boolean)
			.join("\n");
	}

	if (typeof record.text === "string") {
		return record.text;
	}

	return "";
};

const parseJsonEnvelope = (text: string): unknown | null => {
	const trimmed = text.trim();
	if (
		(!trimmed.startsWith("{") || !trimmed.endsWith("}")) &&
		(!trimmed.startsWith("[") || !trimmed.endsWith("]"))
	) {
		return null;
	}

	try {
		return JSON.parse(trimmed) as unknown;
	} catch {
		return null;
	}
};

const extractValidatedAdrCount = (text: string): number | null => {
	const match = text.match(
		/(?:Total\s+ADRs\s+Validated|Validated\s+ADRs|validatedAdrCount|validatedCount|total)\*{0,2}\s*[:=]\s*(\d+)/i,
	);
	return match ? Number.parseInt(match[1] ?? "", 10) : null;
};

const extractAdrPaths = (text: string): string[] => {
	const matches = [
		...text.matchAll(/(?:ADR\s+)?Path\*{0,2}\s*:\s*([^\s]+\.mdx?)/gi),
		...text.matchAll(/"(?:path|adrPath|filePath)":\s*"([^"]+\.mdx?)"/g),
	];

	return [
		...new Set(
			matches
				.map((match) => match[1])
				.filter((value): value is string => typeof value === "string" && value.length > 0),
		),
	];
};

export class ToolRouter {
	private readonly projectRoot: string;
	private config: MimirmeshConfig;
	private readonly logger?: ToolRouterOptions["logger"];
	private readonly executeWithMiddleware: (
		context: MiddlewareContext,
	) => Promise<NormalizedToolResult>;

	constructor(options: ToolRouterOptions) {
		this.projectRoot = options.projectRoot;
		this.config = options.config;
		this.logger = options.logger;

		const defaultMiddlewares = [
			errorNormalizationMiddleware(this.logger),
			timingMiddleware(this.logger),
		];

		this.executeWithMiddleware = applyMiddleware(
			options.middlewares ?? defaultMiddlewares,
			this.executeTool.bind(this),
		);
	}

	public getConfig(): MimirmeshConfig {
		return this.config;
	}

	public setConfig(config: MimirmeshConfig): void {
		this.config = config;
	}

	private translateToolInputForEngine(
		engine: EngineId,
		input: Record<string, unknown>,
	): Record<string, unknown> {
		return translateEngineToolInput(input, {
			projectRoot: this.projectRoot,
			config: this.config,
			engine,
		});
	}

	private normalizePayloadForEngine(engine: EngineId, payload: unknown): unknown {
		return normalizeEnginePayloadPaths(payload, {
			projectRoot: this.projectRoot,
			config: this.config,
			engine,
		});
	}

	private async augmentResultWarnings(
		result: NormalizedToolResult,
		options: {
			engine?: EngineId;
			bridgeFailure?: string;
		} = {},
	): Promise<NormalizedToolResult> {
		const warnings = [...result.warnings];
		const warningCodes = [...result.warningCodes];
		let nextAction = result.nextAction;
		let degraded = result.degraded;

		if (options.engine) {
			const engineState = await loadEngineState(this.projectRoot, options.engine);
			if (engineState && !engineState.bridge.healthy) {
				warnings.push(
					engineState.bridge.lastError
						? `${options.engine} bridge unhealthy: ${engineState.bridge.lastError}`
						: `${options.engine} bridge is not healthy.`,
				);
				warningCodes.push("bridge_unhealthy");
				nextAction ??= "Run `mimirmesh runtime restart --non-interactive` and retry the MCP tool.";
				degraded = true;
			}
		}

		if (options.bridgeFailure) {
			warnings.push(options.bridgeFailure);
			warningCodes.push("bridge_unhealthy");
			nextAction ??= "Run `mimirmesh runtime restart --non-interactive` and retry the MCP tool.";
			degraded = true;
		}

		const upgradeStatus = await classifyUpgradeStatus(this.projectRoot, this.config);
		if (upgradeStatus.report.requiredActions.includes("restart-runtime")) {
			warnings.push(
				"Running Docker containers are older than the generated runtime definition or engine images. Run `mimirmesh runtime restart --non-interactive` to load the current build.",
			);
			warningCodes.push("runtime_restart_required");
			nextAction = "Run `mimirmesh runtime restart --non-interactive` and retry the MCP tool.";
			degraded = true;
		}

		const serverDrift = await detectMcpServerStaleness(this.projectRoot);
		if (serverDrift.state === "stale") {
			warnings.push(
				`The running MCP server process (${serverDrift.session.buildId}) predates the latest build on disk (${serverDrift.latest.buildId}). Restart the IDE MCP session or reconnect the client.`,
			);
			warningCodes.push("mcp_server_stale");
			nextAction ??=
				"Restart the IDE MCP session or reconnect the client so it picks up the latest server build.";
			degraded = true;
		}

		return {
			...result,
			degraded,
			warnings: normalizeWarnings(warnings),
			warningCodes: normalizeWarningCodes(warningCodes),
			nextAction,
		};
	}

	public async listTools(): Promise<ToolDefinition[]> {
		const base: ToolDefinition[] = unifiedToolList.map((tool) => ({
			name: tool.name,
			description: tool.description,
			type: "unified",
		}));

		const runtime = await loadRuntimeRoutingContext(this.projectRoot);
		const passthrough = (runtime.routing?.passthrough ?? []).map((route) => ({
			name: route.publicTool as ToolName,
			description: route.description ?? `${route.engine}.${route.engineTool}`,
			type: "passthrough" as const,
		}));

		return [...base, ...passthrough];
	}

	public async callTool(toolName: ToolName, input: ToolInput = {}): Promise<NormalizedToolResult> {
		return this.executeWithMiddleware({
			toolName,
			input,
			projectRoot: this.projectRoot,
			config: this.config,
		});
	}

	private async executeTool(context: MiddlewareContext): Promise<NormalizedToolResult> {
		if (isUnifiedTool(context.toolName)) {
			return this.executeUnifiedTool(context.toolName, context.input);
		}
		return this.executePassthroughTool(context.toolName, context.input);
	}

	private async executeUnifiedTool(
		toolName: UnifiedToolName,
		input: ToolInput,
	): Promise<NormalizedToolResult> {
		if (toolName === "runtime_status") {
			const status = await runtimeStatus(this.projectRoot, this.config);
			return {
				tool: toolName,
				success: status.ok,
				message: status.message,
				items: status.health.services.map((service, index) => ({
					id: `runtime-${index}`,
					title: service.name,
					content: `state=${service.state} health=${service.health}`,
					score: service.state === "running" ? 100 : 40,
					metadata: {
						state: service.state,
						health: service.health,
					},
				})),
				provenance: [
					{
						engine: "runtime",
						tool: "runtime_status",
						latencyMs: 0,
						health: status.ok ? "healthy" : "degraded",
						note: status.message,
					},
				],
				degraded: status.health.state !== "ready",
				warnings: status.health.reasons,
				warningCodes: [],
				raw: {
					health: status.health,
					connection: status.connection,
				},
			};
		}

		if (toolName === "config_get") {
			const path = typeof input.path === "string" ? input.path : "";
			const value = path ? getConfigValue(this.config, path) : this.config;
			return {
				tool: toolName,
				success: true,
				message: path ? `Read config path ${path}` : "Read full config",
				items: [
					{
						id: "config-get",
						title: path || "config",
						content: JSON.stringify(value, null, 2),
						score: 100,
						metadata: { path },
					},
				],
				provenance: [
					{
						engine: "mimirmesh",
						tool: "config_get",
						latencyMs: 0,
						health: "healthy",
					},
				],
				degraded: false,
				warnings: [],
				warningCodes: [],
			};
		}

		if (toolName === "config_set") {
			const path = typeof input.path === "string" ? input.path : "";
			if (!path) {
				return {
					tool: toolName,
					success: false,
					message: "config_set requires 'path'.",
					items: [],
					provenance: [],
					degraded: true,
					warnings: ["Missing path."],
					warningCodes: [],
				};
			}

			const rawValue = input.value;
			const parsedValue =
				typeof rawValue === "string" ? parseConfigPrimitive(rawValue) : (rawValue as unknown);
			const nextConfig =
				path === "engines.enable"
					? enableEngine(this.config, String(parsedValue) as EngineId)
					: path === "engines.disable"
						? disableEngine(this.config, String(parsedValue) as EngineId)
						: setConfigValue(this.config, path, parsedValue);

			await writeConfig(this.projectRoot, nextConfig);
			this.config = nextConfig;

			return {
				tool: toolName,
				success: true,
				message: `Updated config path ${path}`,
				items: [
					{
						id: "config-set",
						title: path,
						content: JSON.stringify(getConfigValue(nextConfig, path), null, 2),
						score: 100,
						metadata: { path },
					},
				],
				provenance: [
					{
						engine: "mimirmesh",
						tool: "config_set",
						latencyMs: 0,
						health: "healthy",
					},
				],
				degraded: false,
				warnings: [],
				warningCodes: [],
			};
		}

		const runtime = await loadRuntimeRoutingContext(this.projectRoot);
		if (!runtime.routing || !runtime.connection) {
			return {
				tool: toolName,
				success: false,
				message: "Runtime routing table not available. Start runtime first.",
				items: [],
				provenance: [],
				degraded: true,
				warnings: ["Missing runtime routing table"],
				warningCodes: [],
			};
		}
		const ignoreMatcher = await loadRepositoryIgnoreMatcher(this.projectRoot);

		const routes = unifiedRoutesFor(runtime.routing, toolName);
		if (routes.length === 0) {
			return {
				tool: toolName,
				success: false,
				message: `No discovered engine capability for ${toolName}.`,
				items: [],
				provenance: [],
				degraded: true,
				warnings: [
					"Unified routes are generated from live discovery; refresh runtime to rebuild routing.",
				],
				warningCodes: [],
			};
		}

		const routeGroups = new Map<EngineId, typeof routes>();
		for (const route of routes) {
			const existing = routeGroups.get(route.engine) ?? [];
			existing.push(route);
			routeGroups.set(route.engine, existing);
		}

		const groupedResults = await Promise.all(
			[...routeGroups.entries()].map(async ([engine, engineRoutes]) => {
				const adapter = getAdapter(engine);
				const translatedInput = this.translateToolInputForEngine(engine, input);
				if (adapter.executeUnifiedTool) {
					const handled = await adapter.executeUnifiedTool({
						unifiedTool: toolName,
						routes: engineRoutes,
						input: translatedInput,
						projectRoot: this.projectRoot,
						config: this.config,
						bridgePorts: runtime.connection?.bridgePorts ?? {},
						invoke: (tool, args) =>
							invokeEngineTool({
								bridgePorts: runtime.connection?.bridgePorts ?? {},
								engine,
								tool,
								args,
							}),
					});
					if (handled) {
						return handled;
					}
				}

				return Promise.all(
					engineRoutes.map(async (route) => {
						const preparedInput = adapter.prepareToolInput
							? adapter.prepareToolInput(route.engineTool, translatedInput, {
									projectRoot: this.projectRoot,
									config: this.config,
									inputSchema: route.inputSchema,
								})
							: translatedInput;
						const translatedPreparedInput = this.translateToolInputForEngine(
							route.engine,
							preparedInput,
						);
						const startedAt = performance.now();
						const response = await invokeEngineTool({
							bridgePorts: runtime.connection?.bridgePorts ?? {},
							engine: route.engine,
							tool: route.engineTool,
							args: translatedPreparedInput,
						});
						const latencyMs = Math.round(performance.now() - startedAt);
						return {
							route,
							response,
							latencyMs,
						};
					}),
				);
			}),
		);
		const results = groupedResults.flat();

		const provenance: ToolProvenance[] = [];
		const items: ToolResultItem[] = [];
		const warnings: string[] = [];

		for (const result of results) {
			if (!result.response.ok) {
				warnings.push(`${result.route.engine}: ${result.response.error ?? "failed"}`);
				provenance.push({
					engine: result.route.engine,
					tool: result.route.engineTool,
					latencyMs: result.latencyMs,
					health: "unavailable",
					note: result.response.error,
				});
				continue;
			}

			const filteredPayload = filterIgnoredPayload(
				this.normalizePayloadForEngine(result.route.engine, result.response.result),
				this.projectRoot,
				ignoreMatcher,
			);
			if (filteredPayload === undefined) {
				provenance.push({
					engine: result.route.engine,
					tool: result.route.engineTool,
					latencyMs: result.latencyMs,
					health: "healthy",
					note: "Filtered by repository ignore rules",
				});
				continue;
			}
			items.push(...toResultItems(result.route.engine, result.route.engineTool, filteredPayload));
			provenance.push({
				engine: result.route.engine,
				tool: result.route.engineTool,
				latencyMs: result.latencyMs,
				health: "healthy",
			});
		}

		const merged = deduplicateAndRank(items);
		return this.augmentResultWarnings({
			tool: toolName,
			success: merged.length > 0,
			message:
				merged.length > 0
					? `Merged ${merged.length} result item(s) from discovered engine routes.`
					: "No results returned by discovered engine routes.",
			items: merged,
			provenance,
			degraded: warnings.length > 0,
			warnings: normalizeWarnings(warnings),
			warningCodes: [],
			raw: {
				routes,
			},
		});
	}

	private async executePassthroughTool(
		toolName: `${string}.${string}`,
		input: ToolInput,
	): Promise<NormalizedToolResult> {
		const runtime = await loadRuntimeRoutingContext(this.projectRoot);
		if (!runtime.routing || !runtime.connection) {
			return {
				tool: toolName,
				success: false,
				message: "Runtime routing table not available. Start runtime first.",
				items: [],
				provenance: [],
				degraded: true,
				warnings: ["Missing runtime routing table"],
				warningCodes: [],
			};
		}

		const route = passthroughRouteFor(runtime.routing, toolName);
		if (!route) {
			return {
				tool: toolName,
				success: false,
				message: `Unknown passthrough tool: ${toolName}`,
				items: [],
				provenance: [],
				degraded: true,
				warnings: ["Tool is not present in discovered passthrough routes."],
				warningCodes: [],
			};
		}

		const adapter = getAdapter(route.engine);
		const ignoreMatcher = await loadRepositoryIgnoreMatcher(this.projectRoot);
		const translatedInput = this.translateToolInputForEngine(route.engine, input);
		const preparedInput = adapter.prepareToolInput
			? adapter.prepareToolInput(route.engineTool, translatedInput, {
					projectRoot: this.projectRoot,
					config: this.config,
					inputSchema: route.inputSchema,
				})
			: translatedInput;
		const translatedPreparedInput = this.translateToolInputForEngine(route.engine, preparedInput);
		const missingFields = missingRequiredFields(route.inputSchema, translatedPreparedInput);
		if (missingFields.length > 0) {
			return {
				tool: toolName,
				success: false,
				message: `Passthrough input is missing required field(s): ${missingFields.join(", ")}.`,
				items: [],
				provenance: [],
				degraded: true,
				warnings: [`Provide required field(s): ${missingFields.join(", ")}.`],
				warningCodes: [],
				nextAction: "Re-run the MCP tool with the required input fields populated.",
				raw: {
					route,
					missingFields,
				},
			};
		}

		const startedAt = performance.now();
		const response = await invokeEngineTool({
			bridgePorts: runtime.connection.bridgePorts,
			engine: route.engine,
			tool: route.engineTool,
			args: translatedPreparedInput,
		});
		const latencyMs = Math.round(performance.now() - startedAt);
		const adrFallback = await this.tryAdrValidateAllFallback({
			toolName,
			input,
			route,
			latencyMs,
			response,
			runtime,
			preparedInput,
			adapter,
			ignoreMatcher,
		});
		if (adrFallback) {
			return adrFallback;
		}

		if (!response.ok) {
			return this.augmentResultWarnings(
				{
					tool: toolName,
					success: false,
					message: response.error ?? "Passthrough call failed",
					items: [],
					provenance: [
						{
							engine: route.engine,
							tool: route.engineTool,
							latencyMs,
							health: "unavailable",
							note: response.error,
						},
					],
					degraded: true,
					warnings: [response.error ?? "Passthrough call failed"],
					warningCodes: [],
				},
				{
					engine: route.engine,
					bridgeFailure: response.error ?? "Passthrough call failed",
				},
			);
		}
		const filteredPayload = filterIgnoredPayload(
			this.normalizePayloadForEngine(route.engine, response.result),
			this.projectRoot,
			ignoreMatcher,
		);

		return this.augmentResultWarnings(
			{
				tool: toolName,
				success: true,
				message: `Executed passthrough route ${toolName}`,
				items:
					filteredPayload === undefined
						? []
						: toResultItems(route.engine, route.engineTool, filteredPayload),
				provenance: [
					{
						engine: route.engine,
						tool: route.engineTool,
						latencyMs,
						health: "healthy",
					},
				],
				degraded: false,
				warnings: [],
				warningCodes: [],
				raw: {
					route,
				},
			},
			{ engine: route.engine },
		);
	}

	private async tryAdrValidateAllFallback(options: {
		toolName: `${string}.${string}`;
		input: ToolInput;
		route: {
			publicTool: string;
			engine: EngineId;
			engineTool: string;
			description?: string;
			inputSchema?: Record<string, unknown>;
		};
		latencyMs: number;
		response: Awaited<ReturnType<typeof invokeEngineTool>>;
		runtime: Awaited<ReturnType<typeof loadRuntimeRoutingContext>>;
		preparedInput: Record<string, unknown>;
		adapter: ReturnType<typeof getAdapter>;
		ignoreMatcher: Awaited<ReturnType<typeof loadRepositoryIgnoreMatcher>>;
	}): Promise<NormalizedToolResult | null> {
		if (
			options.route.engine !== "mcp-adr-analysis-server" ||
			options.route.engineTool !== "validate_all_adrs" ||
			!options.response.ok
		) {
			return null;
		}

		const validatedCount = extractValidatedAdrCount(extractTextContent(options.response.result));
		if (validatedCount === null || validatedCount > 0) {
			return null;
		}

		const discoverRoute = options.runtime.routing?.passthrough.find(
			(route) =>
				route.engine === "mcp-adr-analysis-server" && route.engineTool === "discover_existing_adrs",
		);
		const validateRoute = options.runtime.routing?.passthrough.find(
			(route) => route.engine === "mcp-adr-analysis-server" && route.engineTool === "validate_adr",
		);
		if (!discoverRoute || !validateRoute) {
			return null;
		}

		const prepareInput = (routeInput: typeof discoverRoute, value: Record<string, unknown>) =>
			this.translateToolInputForEngine(
				routeInput.engine,
				options.adapter.prepareToolInput
					? options.adapter.prepareToolInput(routeInput.engineTool, value, {
							projectRoot: this.projectRoot,
							config: this.config,
							inputSchema: routeInput.inputSchema,
						})
					: value,
			);

		const discoverStartedAt = performance.now();
		const discoverResponse = await invokeEngineTool({
			bridgePorts: options.runtime.connection?.bridgePorts ?? {},
			engine: discoverRoute.engine,
			tool: discoverRoute.engineTool,
			args: prepareInput(discoverRoute, {}),
		});
		const discoverLatencyMs = Math.round(performance.now() - discoverStartedAt);
		if (!discoverResponse.ok) {
			return null;
		}

		const adrPaths = extractAdrPaths(extractTextContent(discoverResponse.result));
		if (adrPaths.length === 0) {
			return null;
		}

		const validationRuns = await Promise.all(
			adrPaths.map(async (adrPath) => {
				const validateStartedAt = performance.now();
				const validationResponse = await invokeEngineTool({
					bridgePorts: options.runtime.connection?.bridgePorts ?? {},
					engine: validateRoute.engine,
					tool: validateRoute.engineTool,
					args: prepareInput(validateRoute, { adrPath }),
				});
				return {
					adrPath,
					response: validationResponse,
					latencyMs: Math.round(performance.now() - validateStartedAt),
				};
			}),
		);

		const warnings = [
			"Upstream validate_all_adrs returned 0 ADRs; used discover_existing_adrs + validate_adr fallback.",
		];
		let validatedAdrCount = 0;
		const items = validationRuns.flatMap((run) => {
			if (!run.response.ok) {
				warnings.push(`${run.adrPath}: ${run.response.error ?? "validation failed"}`);
				return [];
			}

			const filteredPayload = filterIgnoredPayload(
				this.normalizePayloadForEngine(validateRoute.engine, run.response.result),
				this.projectRoot,
				options.ignoreMatcher,
			);
			if (filteredPayload !== undefined) {
				validatedAdrCount += 1;
			}
			return filteredPayload === undefined
				? []
				: toResultItems(validateRoute.engine, validateRoute.engineTool, filteredPayload);
		});

		return this.augmentResultWarnings(
			{
				tool: options.toolName,
				success: validatedAdrCount > 0,
				message: `Validated ${validatedAdrCount} ADR(s) via passthrough fallback after upstream validate_all_adrs returned 0.`,
				items,
				provenance: [
					{
						engine: options.route.engine,
						tool: options.route.engineTool,
						latencyMs: options.latencyMs,
						health: "healthy",
						note: "Upstream response reported 0 ADRs.",
					},
					{
						engine: discoverRoute.engine,
						tool: discoverRoute.engineTool,
						latencyMs: discoverLatencyMs,
						health: "healthy",
					},
					...validationRuns.map((run) => ({
						engine: validateRoute.engine,
						tool: validateRoute.engineTool,
						latencyMs: run.latencyMs,
						health: run.response.ok ? ("healthy" as const) : ("unavailable" as const),
						note: run.response.ok ? run.adrPath : (run.response.error ?? run.adrPath),
					})),
				],
				degraded: warnings.length > 0,
				warnings: normalizeWarnings(warnings),
				warningCodes: ["upstream_tool_fallback_used"],
				raw: {
					route: options.route,
					fallbackAdrPaths: adrPaths,
					originalInput: options.preparedInput,
				},
			},
			{ engine: options.route.engine },
		);
	}
}

export const createToolRouter = (options: ToolRouterOptions): ToolRouter => new ToolRouter(options);
export const unifiedTools = unifiedToolList;
export { unifiedToolDescriptions, unifiedToolInputSchemas };
