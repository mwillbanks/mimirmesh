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
	loadSkillRegistrySnapshot,
	openRouteTelemetryStore,
	persistMcpToolSurfaceSession,
	refreshSkillRegistryStore,
	resolveSkillRegistryEmbeddingMatches,
	runtimeStatus,
	summarizeRouteTelemetryHealth,
} from "@mimirmesh/runtime";
import {
	buildReadSignature,
	createSkillPackage,
	findSkills,
	readSkill,
	resolveSkills,
	type SkillReadRequest,
	type SkillResolvePolicy,
	type SkillsCreateRequest,
	type SkillsFindRequest,
	type SkillsRefreshRequest,
	type SkillsResolveRequest,
	type SkillsUpdateRequest,
	updateSkillPackage,
} from "@mimirmesh/skills";
import { loadRepositoryIgnoreMatcher } from "@mimirmesh/workspace";

import {
	loadOrCreateMcpToolSurfaceSession,
	loadRuntimeRoutingContext,
	refreshDeferredEngineDiscovery,
	toolSurfacePolicyVersion,
} from "../discovery/runtime";
import { deduplicateAndRank } from "../merge/results";
import { buildRetiredPassthroughAliasResult, retiredPassthroughAliasFor } from "../passthrough";
import { normalizeEnginePayloadPaths, translateEngineToolInput } from "../paths/translation";
import {
	executionStrategyForRoute,
	resolveAdaptiveRouteHintAllowlist,
	routeHintModeLabel,
} from "../routing/hints";
import {
	buildRouteProfileKey,
	buildRouteRequestFingerprint,
	summarizeToolInput,
} from "../routing/summaries";
import { passthroughRouteFor, unifiedRoutesFor } from "../routing/table";
import { invokeEngineTool } from "../transport/bridge";
import type {
	MiddlewareContext,
	NormalizedToolResult,
	RoutingEngineRoute,
	ToolDefinition,
	ToolInput,
	ToolName,
	ToolProvenance,
	ToolResultItem,
	ToolRouterOptions,
	ToolSchemaDetailLevel,
	ToolSchemaInspection,
	ToolSurfaceSummary,
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

const buildSkillResultItem = (
	id: string,
	title: string,
	content: string,
	score: number,
	metadata: Record<string, unknown> = {},
): ToolResultItem => ({
	id,
	title,
	content,
	score,
	metadata,
});
const managementToolNames = new Set<UnifiedToolName>([
	"load_deferred_tools",
	"refresh_tool_surface",
	"inspect_tool_schema",
]);
const engineDisplayNames: Record<EngineId, string> = {
	srclight: "Srclight",
	"document-mcp": "Document MCP",
	"mcp-adr-analysis-server": "ADR Analysis",
};

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

const schemaProperties = (
	inputSchema: Record<string, unknown> | undefined,
): Record<string, unknown> => {
	const properties = inputSchema?.properties;
	return typeof properties === "object" && properties !== null
		? (properties as Record<string, unknown>)
		: {};
};

const optionalFieldsForSchema = (inputSchema: Record<string, unknown> | undefined): string[] => {
	const required = new Set(requiredFieldsForSchema(inputSchema));
	return Object.keys(schemaProperties(inputSchema)).filter((field) => !required.has(field));
};

const formatArgumentHints = (inputSchema: Record<string, unknown> | undefined): string[] => {
	const required = requiredFieldsForSchema(inputSchema).map((field) => `req:${field}`);
	const optional = optionalFieldsForSchema(inputSchema).map((field) => `opt:${field}`);
	return [...required, ...optional];
};

const summarizeArgumentHints = (
	inputSchema: Record<string, unknown> | undefined,
): string | undefined => {
	const hints = formatArgumentHints(inputSchema);
	if (hints.length === 0) {
		return undefined;
	}
	return hints.join(", ");
};

const compressDescription = (
	description: string,
	inputSchema: Record<string, unknown> | undefined,
	level: MimirmeshConfig["mcp"]["toolSurface"]["compressionLevel"],
): string => {
	const summary = description.trim().replace(/\s+/g, " ");
	if (level === "minimal") {
		return summary;
	}
	const hints = summarizeArgumentHints(inputSchema);
	if (!hints) {
		return summary;
	}
	if (level === "balanced") {
		return `${summary} Args: ${hints}.`;
	}
	const sentence = summary.split(/[.!?]/)[0]?.trim() ?? summary;
	return `${sentence}. Args: ${hints}.`;
};

const zodTypeLabel = (schema: unknown): string => {
	const candidate = schema as {
		type?: string;
		unwrap?: () => unknown;
		options?: string[];
		element?: unknown;
		constructor?: { name?: string };
	};
	if (typeof candidate?.unwrap === "function") {
		return zodTypeLabel(candidate.unwrap());
	}
	if (Array.isArray(candidate?.options)) {
		return `enum(${candidate.options.join(", ")})`;
	}
	if (candidate?.type === "string" || candidate?.constructor?.name === "ZodString") {
		return "string";
	}
	if (candidate?.type === "number" || candidate?.constructor?.name === "ZodNumber") {
		return "number";
	}
	if (candidate?.type === "boolean" || candidate?.constructor?.name === "ZodBoolean") {
		return "boolean";
	}
	if (candidate?.type === "array" || candidate?.constructor?.name === "ZodArray") {
		return `array<${zodTypeLabel(candidate.element)}>`;
	}
	return "unknown";
};

const unifiedShapeToJsonSchema = (shape: Record<string, unknown>): Record<string, unknown> => {
	const required: string[] = [];
	const properties = Object.fromEntries(
		Object.entries(shape).map(([name, schema]) => {
			const optional =
				typeof schema === "object" &&
				schema !== null &&
				((schema as { isOptional?: () => boolean }).isOptional?.() === true ||
					(schema as { constructor?: { name?: string } }).constructor?.name === "ZodOptional");
			if (!optional) {
				required.push(name);
			}
			return [
				name,
				{
					type: zodTypeLabel(schema),
					description:
						(typeof schema === "object" &&
							schema !== null &&
							(schema as { description?: string }).description) ??
						"",
				},
			];
		}),
	);
	return {
		type: "object",
		properties,
		required,
	};
};

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

const normalizeResultPayloadForItems = (payload: unknown): unknown | undefined => {
	if (payload === null || payload === undefined) {
		return undefined;
	}
	if (Array.isArray(payload)) {
		return payload.length > 0 ? payload : undefined;
	}
	const record = asRecord(payload);
	if (!record) {
		return typeof payload === "string"
			? payload.trim().length > 0
				? payload
				: undefined
			: payload;
	}
	if ("result" in record) {
		return normalizeResultPayloadForItems(record.result);
	}
	if (Array.isArray(record.results)) {
		return record.results.length > 0 ? record.results : undefined;
	}
	if (Array.isArray(record.matches)) {
		return record.matches.length > 0 ? record.matches : undefined;
	}
	if (Array.isArray(record.content)) {
		return record.content.length > 0 ? payload : undefined;
	}
	return Object.keys(record).length > 0 ? payload : undefined;
};

const toUsableResultItems = (engine: string, tool: string, payload: unknown): ToolResultItem[] => {
	const usablePayload = normalizeResultPayloadForItems(payload);
	return usablePayload === undefined ? [] : toResultItems(engine, tool, usablePayload);
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

const routeSnapshotKey = (route: Pick<RoutingEngineRoute, "engine" | "engineTool">): string =>
	`${route.engine}:${route.engineTool}`;

const jsonByteLength = (value: unknown): number => {
	try {
		return Buffer.byteLength(JSON.stringify(value ?? null));
	} catch {
		return 0;
	}
};

const failureClassificationFor = (error: string | undefined): string | null => {
	if (!error?.trim()) {
		return null;
	}
	if (/timeout/i.test(error)) {
		return "timeout";
	}
	if (/bridge|unavailable|connection/i.test(error)) {
		return "bridge";
	}
	return "tool-error";
};

export class ToolRouter {
	private readonly projectRoot: string;
	private config: MimirmeshConfig;
	private readonly sessionId: string;
	private readonly logger?: ToolRouterOptions["logger"];
	private readonly adapterResolver: NonNullable<ToolRouterOptions["adapterResolver"]>;
	private readonly engineInvoker: NonNullable<ToolRouterOptions["engineInvoker"]>;
	private readonly executeWithMiddleware: (
		context: MiddlewareContext,
	) => Promise<NormalizedToolResult>;

	constructor(options: ToolRouterOptions) {
		this.projectRoot = options.projectRoot;
		this.config = options.config;
		this.sessionId = options.sessionId ?? process.env.MIMIRMESH_SESSION_ID ?? "cli-default";
		this.logger = options.logger;
		this.adapterResolver = options.adapterResolver ?? getAdapter;
		this.engineInvoker = options.engineInvoker ?? invokeEngineTool;

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

	public getSessionId(): string {
		return this.sessionId;
	}

	public setConfig(config: MimirmeshConfig): void {
		this.config = config;
	}

	private async resolveSessionState() {
		const runtime = await loadRuntimeRoutingContext(this.projectRoot);
		const session = await loadOrCreateMcpToolSurfaceSession(
			this.projectRoot,
			this.config,
			this.sessionId,
		);
		const expectedPolicyVersion = toolSurfacePolicyVersion(this.config);
		if (
			session.policyVersion !== expectedPolicyVersion ||
			session.compressionLevel !== this.config.mcp.toolSurface.compressionLevel
		) {
			const updatedSession = {
				...session,
				policyVersion: expectedPolicyVersion,
				compressionLevel: this.config.mcp.toolSurface.compressionLevel,
				lastUpdatedAt: new Date().toISOString(),
			};
			await persistMcpToolSurfaceSession(this.projectRoot, updatedSession);
			return {
				runtime,
				session: updatedSession,
			};
		}
		return { runtime, session };
	}

	private buildToolDefinition(options: {
		name: ToolName;
		description: string;
		type: ToolDefinition["type"];
		originEngine?: EngineId | "mimirmesh";
		sessionState: NonNullable<ToolDefinition["sessionState"]>;
		inputSchema?: Record<string, unknown>;
	}): ToolDefinition {
		const argumentHints = formatArgumentHints(options.inputSchema);
		return {
			name: options.name,
			description: compressDescription(
				options.description,
				options.inputSchema,
				this.config.mcp.toolSurface.compressionLevel,
			),
			type: options.type,
			originEngine: options.originEngine ?? "mimirmesh",
			sessionState: options.sessionState,
			compressionLevel:
				options.type === "passthrough" ? this.config.mcp.toolSurface.compressionLevel : undefined,
			argumentHints: argumentHints.length > 0 ? argumentHints : undefined,
			inputSchema: options.inputSchema,
			fullSchemaAvailable: options.inputSchema
				? this.config.mcp.toolSurface.fullSchemaAccess
				: undefined,
		};
	}

	private async visiblePassthroughTools(): Promise<ToolDefinition[]> {
		const { runtime, session } = await this.resolveSessionState();
		const core = new Set(this.config.mcp.toolSurface.coreEngineGroups);
		const loaded = new Set(session.loadedEngineGroups);
		return (runtime.routing?.passthrough ?? [])
			.filter(
				(route) => route.publication == null || core.has(route.engine) || loaded.has(route.engine),
			)
			.map((route) =>
				this.buildToolDefinition({
					name: (route.publication?.publishedTool ?? route.publicTool) as ToolName,
					description: route.description ?? `${route.engine}.${route.engineTool}`,
					type: "passthrough",
					originEngine: route.engine,
					sessionState:
						route.publication == null ? "core" : loaded.has(route.engine) ? "loaded" : "core",
					inputSchema: route.inputSchema,
				}),
			);
	}

	public async inspectToolSurface(): Promise<ToolSurfaceSummary> {
		const { runtime, session } = await this.resolveSessionState();
		const tools = await this.listTools();
		const loaded = new Set(session.loadedEngineGroups);
		const core = new Set(this.config.mcp.toolSurface.coreEngineGroups);
		const deferred = new Set(this.config.mcp.toolSurface.deferredEngineGroups);
		const deferredEngineGroups = (
			Object.entries(this.config.engines) as Array<[EngineId, MimirmeshConfig["engines"][EngineId]]>
		)
			.filter(([engine]) => deferred.has(engine) || loaded.has(engine) || core.has(engine))
			.map(([engine, engineConfig]) => {
				const state = runtime.routing?.passthrough.filter((route) => route.engine === engine) ?? [];
				const engineState: "loaded" | "unavailable" | "deferred" = loaded.has(engine)
					? "loaded"
					: !engineConfig.enabled
						? "unavailable"
						: "deferred";
				return {
					engineId: engine,
					displayName: engineDisplayNames[engine],
					toolCount: state.length,
					availabilityState: engineState,
					healthMessage:
						engineState === "unavailable"
							? "Engine disabled in config."
							: runtime.routing
								? "Deferred until loaded."
								: "Runtime routing unavailable.",
					lastDiscoveredAt: runtime.routing?.generatedAt ?? null,
				};
			});

		return {
			sessionId: session.sessionId,
			policyVersion: session.policyVersion,
			compressionLevel: session.compressionLevel,
			coreToolCount: tools.filter((tool) => tool.sessionState === "core").length,
			toolCount: tools.length,
			loadedEngineGroups: [...session.loadedEngineGroups],
			deferredEngineGroups,
			tools,
			diagnostics: session.lazyLoadDiagnostics.map((diagnostic) => ({
				engineId: diagnostic.engineId,
				outcome: diagnostic.outcome,
				completedAt: diagnostic.completedAt,
				message: diagnostic.diagnostics.join("; ") || diagnostic.outcome,
			})),
		};
	}

	public async inspectToolSchema(
		toolName: ToolName,
		detailLevel: ToolSchemaDetailLevel = "compressed",
	): Promise<ToolSchemaInspection> {
		const { runtime } = await this.resolveSessionState();
		if (isUnifiedTool(toolName)) {
			const schemaPayload = unifiedShapeToJsonSchema(unifiedToolInputSchemas[toolName]);
			return {
				toolName,
				sessionId: this.sessionId,
				detailLevel,
				resolvedEngine: "mimirmesh",
				schemaPayload:
					detailLevel === "compressed"
						? {
								description: compressDescription(
									unifiedToolDescriptions[toolName],
									schemaPayload,
									this.config.mcp.toolSurface.compressionLevel,
								),
								argumentHints: summarizeArgumentHints(schemaPayload),
							}
						: {
								description: unifiedToolDescriptions[toolName],
								inputSchema: schemaPayload,
							},
			};
		}

		const route = runtime.routing ? passthroughRouteFor(runtime.routing, toolName) : null;
		if (!route) {
			throw new Error(`Tool schema unavailable for ${toolName}.`);
		}
		return {
			toolName,
			sessionId: this.sessionId,
			detailLevel,
			resolvedEngine: route.engine,
			schemaPayload:
				detailLevel === "compressed"
					? {
							description: compressDescription(
								route.description ?? `${route.engine}.${route.engineTool}`,
								route.inputSchema,
								this.config.mcp.toolSurface.compressionLevel,
							),
							argumentHints: summarizeArgumentHints(route.inputSchema),
						}
					: {
							description: route.description ?? `${route.engine}.${route.engineTool}`,
							inputSchema: route.inputSchema ?? { type: "object", properties: {} },
						},
		};
	}

	public async loadDeferredToolGroup(
		engine: EngineId,
		trigger: "explicit-load" | "tool-invocation" | "refresh" = "explicit-load",
	): Promise<ToolSurfaceSummary> {
		const startedAt = new Date().toISOString();
		const { session } = await this.resolveSessionState();
		try {
			const refreshed = await refreshDeferredEngineDiscovery({
				projectRoot: this.projectRoot,
				config: this.config,
				engine,
			});
			const nextSession = {
				...session,
				policyVersion: toolSurfacePolicyVersion(this.config),
				compressionLevel: this.config.mcp.toolSurface.compressionLevel,
				loadedEngineGroups: [...new Set([...session.loadedEngineGroups, engine])],
				lastLoadedAt: new Date().toISOString(),
				lastUpdatedAt: new Date().toISOString(),
				lazyLoadDiagnostics: [
					{
						sessionId: session.sessionId,
						engineId: engine,
						trigger,
						startedAt,
						completedAt: new Date().toISOString(),
						outcome: "success" as const,
						discoveredToolCount: refreshed.discoveredToolCount,
						diagnostics: [`Loaded ${refreshed.discoveredToolCount} tool(s).`],
						notificationSent: false,
					},
					...session.lazyLoadDiagnostics,
				].slice(0, 20),
			};
			await persistMcpToolSurfaceSession(this.projectRoot, nextSession);
			return this.inspectToolSurface();
		} catch (error) {
			const nextSession = {
				...session,
				lastUpdatedAt: new Date().toISOString(),
				lazyLoadDiagnostics: [
					{
						sessionId: session.sessionId,
						engineId: engine,
						trigger,
						startedAt,
						completedAt: new Date().toISOString(),
						outcome: "failed" as const,
						discoveredToolCount: 0,
						diagnostics: [error instanceof Error ? error.message : String(error)],
						notificationSent: false,
					},
					...session.lazyLoadDiagnostics,
				].slice(0, 20),
			};
			await persistMcpToolSurfaceSession(this.projectRoot, nextSession);
			throw error;
		}
	}

	public async markToolSurfaceNotified(): Promise<void> {
		const session = await loadOrCreateMcpToolSurfaceSession(
			this.projectRoot,
			this.config,
			this.sessionId,
		);
		await persistMcpToolSurfaceSession(this.projectRoot, {
			...session,
			lastNotificationAt: new Date().toISOString(),
			lastUpdatedAt: new Date().toISOString(),
			lazyLoadDiagnostics: session.lazyLoadDiagnostics.map((diagnostic, index) =>
				index === 0 ? { ...diagnostic, notificationSent: true } : diagnostic,
			),
		});
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
		const base: ToolDefinition[] = unifiedToolList.map((tool) =>
			this.buildToolDefinition({
				name: tool.name,
				description: tool.description,
				type: managementToolNames.has(tool.name) ? "management" : "unified",
				originEngine: "mimirmesh",
				sessionState: "core",
				inputSchema:
					isUnifiedTool(tool.name) && !tool.name.startsWith("skills.")
						? unifiedShapeToJsonSchema(unifiedToolInputSchemas[tool.name])
						: undefined,
			}),
		);

		const passthrough = await this.visiblePassthroughTools();
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
		const skillPolicy = (
			this.config as MimirmeshConfig & {
				skills?: SkillResolvePolicy & {
					read?: { defaultMode?: "memory" | "instructions" | "assets" | "full" };
				};
			}
		).skills;
		if (toolName === "skills.find") {
			const skillRegistry = await loadSkillRegistrySnapshot(this.projectRoot, this.config);
			const result = await findSkills(
				this.projectRoot,
				input as SkillsFindRequest,
				skillRegistry.skills,
			);
			const registryReady =
				skillRegistry.readiness.state === "ready" && skillRegistry.lastIndexedAt;
			const nextAction = registryReady
				? undefined
				: "Run `skills.refresh` after the runtime is available to build the repository skill index.";
			return {
				tool: toolName,
				success: true,
				message: `Found ${result.total} skill(s).`,
				items: result.results.map((entry) =>
					buildSkillResultItem(entry.cacheKey, entry.name, entry.shortDescription, 100),
				),
				provenance: [{ engine: "mimirmesh", tool: "skills.find", latencyMs: 0, health: "healthy" }],
				degraded: !registryReady,
				warnings: registryReady ? [] : skillRegistry.readiness.reasons,
				warningCodes: [],
				nextAction,
				raw: result,
			};
		}

		if (toolName === "skills.read") {
			const request = input as SkillReadRequest;
			const skillRegistry = await loadSkillRegistrySnapshot(this.projectRoot, this.config);
			const resolvedRequest = {
				...request,
				mode: request.mode ?? skillPolicy?.read?.defaultMode ?? "memory",
			} satisfies SkillReadRequest;
			if (!skillRegistry.lastIndexedAt) {
				throw new Error(
					"Skill registry has not been indexed for this repository. Run `skills.refresh` first.",
				);
			}
			const record = skillRegistry.skills.find((entry) => entry.name === resolvedRequest.name);
			if (!record) {
				throw new Error(`Skill not found: ${resolvedRequest.name}`);
			}
			const readSignature = buildReadSignature(resolvedRequest);
			const cached = skillRegistry.positiveCache.find(
				(entry) =>
					entry.skillName === resolvedRequest.name &&
					entry.readSignature === readSignature &&
					entry.contentHash === record.contentHash,
			);
			const result = cached
				? (cached.payload as Awaited<ReturnType<typeof readSkill>>)
				: await readSkill(this.projectRoot, resolvedRequest, skillRegistry.skills);
			return {
				tool: toolName,
				success: true,
				message: `Read skill ${result.name} in ${result.mode} mode.`,
				items: [
					buildSkillResultItem(
						result.readSignature,
						result.name,
						result.mode === "memory"
							? "Returned the minimal memory projection."
							: `Returned the ${result.mode} projection.`,
						100,
					),
				],
				provenance: [{ engine: "mimirmesh", tool: "skills.read", latencyMs: 0, health: "healthy" }],
				degraded: skillRegistry.readiness.state !== "ready",
				warnings: skillRegistry.readiness.state === "ready" ? [] : skillRegistry.readiness.reasons,
				warningCodes: [],
				raw: result,
			};
		}

		if (toolName === "skills.resolve") {
			const skillRegistry = await loadSkillRegistrySnapshot(this.projectRoot, this.config);
			const embeddingMatches = await resolveSkillRegistryEmbeddingMatches(
				this.projectRoot,
				this.config,
				{
					prompt: String((input as SkillsResolveRequest).prompt ?? ""),
					limit: (input as SkillsResolveRequest).limit,
				},
			);
			const result = await resolveSkills(
				this.projectRoot,
				input as SkillsResolveRequest,
				skillPolicy,
				skillRegistry.skills,
				{
					embeddingMatches: embeddingMatches.matches,
				},
			);
			const registryReady =
				skillRegistry.readiness.state === "ready" && skillRegistry.lastIndexedAt;
			return {
				tool: toolName,
				success: true,
				message: `Resolved ${result.total} skill(s).`,
				items: result.results.map((entry) =>
					buildSkillResultItem(
						entry.cacheKey,
						entry.name,
						entry.shortDescription,
						Math.round(entry.score ?? 100),
					),
				),
				provenance: [
					{ engine: "mimirmesh", tool: "skills.resolve", latencyMs: 0, health: "healthy" },
				],
				degraded: !registryReady || embeddingMatches.diagnostics.length > 0,
				warnings: [
					...(registryReady ? [] : skillRegistry.readiness.reasons),
					...embeddingMatches.diagnostics,
				],
				warningCodes: [],
				nextAction: registryReady
					? undefined
					: "Run `skills.refresh` after the runtime is available to build the repository skill index.",
				raw: result,
			};
		}

		if (toolName === "skills.refresh") {
			const { response: result } = await refreshSkillRegistryStore(
				this.projectRoot,
				this.config,
				input as SkillsRefreshRequest,
			);
			return {
				tool: toolName,
				success: true,
				message: `Refreshed ${result.refreshedSkills.length} skill(s).`,
				items: result.refreshedSkills.map((name, index) =>
					buildSkillResultItem(`skills-refresh-${index}`, name, "refreshed", 100),
				),
				provenance: [
					{ engine: "mimirmesh", tool: "skills.refresh", latencyMs: 0, health: "healthy" },
				],
				degraded: result.runtimeReadiness.healthClassification !== "healthy",
				warnings: result.diagnostics ?? [],
				warningCodes: [],
				nextAction: result.runtimeReadiness.ready
					? undefined
					: "Start the runtime or repair the embedding provider, then rerun `skills.refresh`.",
				raw: result,
			};
		}

		if (toolName === "skills.create") {
			const result = await createSkillPackage(this.projectRoot, input as SkillsCreateRequest);
			return {
				tool: toolName,
				success: result.validation.status !== "failed",
				message: `Create workflow completed in ${result.mode} mode.`,
				items: [
					{
						id: result.generatedSkillName ?? "skills-create",
						title: result.generatedSkillName ?? "generated-skill",
						content: JSON.stringify(result, null, 2),
						score: 100,
						metadata: result,
					},
				],
				provenance: [
					{ engine: "mimirmesh", tool: "skills.create", latencyMs: 0, health: "healthy" },
				],
				degraded: result.validation.status === "failed",
				warnings: result.validation.findings,
				warningCodes: [],
				raw: result,
			};
		}

		if (toolName === "skills.update") {
			const request = input as SkillsUpdateRequest;
			const result = await updateSkillPackage(this.projectRoot, request);
			return {
				tool: toolName,
				success: result.validation.status !== "failed",
				message: `Update workflow completed in ${result.mode} mode.`,
				items: [
					{
						id: result.name,
						title: result.name,
						content: JSON.stringify(result, null, 2),
						score: 100,
						metadata: result,
					},
				],
				provenance: [
					{ engine: "mimirmesh", tool: "skills.update", latencyMs: 0, health: "healthy" },
				],
				degraded: result.validation.status === "failed",
				warnings: result.validation.findings,
				warningCodes: [],
				raw: result,
			};
		}

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

		if (toolName === "load_deferred_tools") {
			const engine = input.engine;
			if (
				engine !== "srclight" &&
				engine !== "document-mcp" &&
				engine !== "mcp-adr-analysis-server"
			) {
				return {
					tool: toolName,
					success: false,
					message: "load_deferred_tools requires a valid engine.",
					items: [],
					provenance: [],
					degraded: true,
					warnings: ["Provide engine as srclight, document-mcp, or mcp-adr-analysis-server."],
					warningCodes: [],
				};
			}
			const surface = await this.loadDeferredToolGroup(engine, "explicit-load");
			return {
				tool: toolName,
				success: true,
				message: `Loaded deferred engine group ${engine}.`,
				items: [
					{
						id: "load-deferred-tools",
						title: engine,
						content: JSON.stringify(surface, null, 2),
						score: 100,
						metadata: surface,
					},
				],
				provenance: [
					{
						engine: "mimirmesh",
						tool: "load_deferred_tools",
						latencyMs: 0,
						health: "healthy",
					},
				],
				degraded: false,
				warnings: [],
				warningCodes: [],
				raw: surface,
			};
		}

		if (toolName === "refresh_tool_surface") {
			const requested = input.engine;
			const session = await loadOrCreateMcpToolSurfaceSession(
				this.projectRoot,
				this.config,
				this.sessionId,
			);
			const targets: EngineId[] =
				requested === "srclight" ||
				requested === "document-mcp" ||
				requested === "mcp-adr-analysis-server"
					? [requested]
					: session.loadedEngineGroups;
			for (const engine of targets) {
				await this.loadDeferredToolGroup(engine, "refresh");
			}
			const surface = await this.inspectToolSurface();
			return {
				tool: toolName,
				success: true,
				message:
					targets.length === 0
						? "No loaded deferred engine groups required refresh."
						: `Refreshed ${targets.length} loaded deferred engine group(s).`,
				items: [
					{
						id: "refresh-tool-surface",
						title: "tool-surface",
						content: JSON.stringify(surface, null, 2),
						score: 100,
						metadata: surface,
					},
				],
				provenance: [
					{
						engine: "mimirmesh",
						tool: "refresh_tool_surface",
						latencyMs: 0,
						health: "healthy",
					},
				],
				degraded: false,
				warnings: [],
				warningCodes: [],
				raw: surface,
			};
		}

		if (toolName === "inspect_tool_schema") {
			const target = typeof input.toolName === "string" ? input.toolName : "";
			if (!target) {
				return {
					tool: toolName,
					success: false,
					message: "inspect_tool_schema requires toolName.",
					items: [],
					provenance: [],
					degraded: true,
					warnings: ["Provide a visible tool name to inspect."],
					warningCodes: [],
				};
			}
			const view =
				input.view === "full" || input.view === "debug" || input.view === "compressed"
					? input.view
					: "full";
			const schema = await this.inspectToolSchema(target, view);
			return {
				tool: toolName,
				success: true,
				message: `Inspected ${target} schema.`,
				items: [
					{
						id: "inspect-tool-schema",
						title: target,
						content: JSON.stringify(schema.schemaPayload, null, 2),
						score: 100,
						metadata: schema,
					},
				],
				provenance: [
					{
						engine: schema.resolvedEngine,
						tool: "inspect_tool_schema",
						latencyMs: 0,
						health: "healthy",
					},
				],
				degraded: false,
				warnings: [],
				warningCodes: [],
				raw: schema.schemaPayload,
			};
		}

		const runtime = await loadRuntimeRoutingContext(this.projectRoot);
		if (!runtime.routing || (!runtime.connection && toolName !== "inspect_route_hints")) {
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
		const routingTable = runtime.routing;
		if (toolName === "inspect_route_hints") {
			const allowlist = resolveAdaptiveRouteHintAllowlist(this.config);
			const unifiedTool =
				typeof input.unifiedTool === "string" ? (input.unifiedTool as UnifiedToolName) : undefined;
			const engine =
				input.engine === "srclight" ||
				input.engine === "document-mcp" ||
				input.engine === "mcp-adr-analysis-server"
					? input.engine
					: undefined;
			const engineTool = typeof input.engineTool === "string" ? input.engineTool : undefined;
			const profileKey =
				typeof input.profile === "string" && input.profile.trim() ? input.profile : undefined;
			const includeRollups = input.includeRollups === true;
			const limitBuckets =
				typeof input.limitBuckets === "number" && Number.isFinite(input.limitBuckets)
					? input.limitBuckets
					: 8;
			const telemetryStore =
				runtime.connection?.services.includes("mm-postgres") === true
					? await openRouteTelemetryStore(this.projectRoot, this.config)
					: null;

			try {
				const routes = unifiedTool
					? unifiedRoutesFor(runtime.routing, unifiedTool).filter(
							(route) =>
								(!engine || route.engine === engine) &&
								(!engineTool || route.engineTool === engineTool),
						)
					: [];
				const subsetEligible = unifiedTool
					? allowlist.effectiveAllowlist.includes(unifiedTool)
					: false;
				const snapshots =
					unifiedTool && telemetryStore
						? await telemetryStore.listRouteHintSnapshots({
								unifiedTool,
								profileKey,
								engine,
								engineTool,
							})
						: [];
				const maintenanceState = telemetryStore
					? await telemetryStore.loadMaintenanceState()
					: null;
				const health = summarizeRouteTelemetryHealth({
					maintenanceState,
					invalidOverrideWarnings: allowlist.overrideWarnings,
					affectedSourceLabels: snapshots.map((snapshot) => snapshot.sourceLabel),
					unavailableReason: telemetryStore
						? null
						: "Runtime PostgreSQL is unavailable. Start the runtime before using route telemetry.",
				});

				if (!unifiedTool) {
					const response = {
						telemetryHealth: {
							state: health.state,
							lastSuccessfulCompactionAt: health.lastSuccessfulCompactionAt,
							lagSeconds: health.lagSeconds,
							warnings: health.warnings,
						},
						maintenanceStatus: health.maintenanceStatus,
						adaptiveSubset: allowlist,
					};
					return {
						tool: toolName,
						success: true,
						message: "Inspected route telemetry health and adaptive subset state.",
						items: [
							{
								id: "inspect-route-hints-summary",
								title: "route-hints",
								content: JSON.stringify(response, null, 2),
								score: 100,
								metadata: response,
							},
						],
						provenance: [
							{
								engine: "mimirmesh",
								tool: "inspect_route_hints",
								latencyMs: 0,
								health: telemetryStore ? "healthy" : "degraded",
							},
						],
						degraded: health.state !== "ready",
						warnings: health.warnings,
						warningCodes: [],
						raw: response,
					};
				}

				const buildOrdering = (
					_targetProfileKey: string | undefined,
					profileSnapshots: typeof snapshots,
				) => {
					const orderedRoutes = unifiedRoutesFor(routingTable, unifiedTool, {
						hintSnapshots: subsetEligible ? profileSnapshots : [],
					}).filter(
						(route) =>
							(!engine || route.engine === engine) &&
							(!engineTool || route.engineTool === engineTool),
					);
					const snapshotsByKey = new Map(
						profileSnapshots.map((snapshot) => [routeSnapshotKey(snapshot), snapshot]),
					);
					return orderedRoutes.map((route) => {
						const snapshot = snapshotsByKey.get(routeSnapshotKey(route));
						return {
							engine: route.engine,
							engineTool: route.engineTool,
							effectiveCostScore: snapshot?.effectiveCostScore ?? 0,
							confidence: snapshot?.confidence ?? 0,
							sampleCount: snapshot?.sampleCount ?? 0,
							orderingReasonCodes: snapshot?.orderingReasonCodes ?? [
								"seed_hint",
								"static_priority",
							],
							estimatedInputTokens:
								snapshot?.estimatedInputTokens ?? route.seedHint?.estimatedInputTokens ?? 0,
							estimatedOutputTokens:
								snapshot?.estimatedOutputTokens ?? route.seedHint?.estimatedOutputTokens ?? 0,
							estimatedLatencyMs:
								snapshot?.estimatedLatencyMs ?? route.seedHint?.estimatedLatencyMs ?? 0,
							estimatedSuccessRate:
								snapshot?.estimatedSuccessRate ?? route.seedHint?.expectedSuccessRate ?? 0,
							lastObservedAt: snapshot?.lastObservedAt ?? null,
						};
					});
				};

				if (profileKey) {
					const profileSnapshots = snapshots.filter(
						(snapshot) => snapshot.profileKey === profileKey,
					);
					const ordered = buildOrdering(profileKey, profileSnapshots);
					const primary = profileSnapshots[0];
					const response = {
						telemetryHealth: {
							state: health.state,
							lastSuccessfulCompactionAt: health.lastSuccessfulCompactionAt,
							lagSeconds: health.lagSeconds,
							warnings: health.warnings,
						},
						maintenanceStatus: {
							...health.maintenanceStatus,
							affectedSourceLabels:
								profileSnapshots.length > 0
									? [...new Set(profileSnapshots.map((snapshot) => snapshot.sourceLabel))]
									: health.maintenanceStatus.affectedSourceLabels,
						},
						adaptiveSubset: allowlist,
						inspection: {
							unifiedTool,
							profileScope: "profile" as const,
							profileKey,
							subsetEligible,
							executionStrategy: routes[0] ? executionStrategyForRoute(routes[0]) : "fanout",
							sourceMode: primary?.sourceMode ?? "static",
							sourceLabel: primary?.sourceLabel ?? routeHintModeLabel("static"),
							freshnessState: primary?.freshnessState ?? "unknown",
							freshnessAgeSeconds: primary?.freshnessAgeSeconds ?? null,
							currentOrdering: ordered,
							...(includeRollups && telemetryStore
								? {
										recentRollups: {
											last15m: await telemetryStore.listRollups({
												tier: "last15m",
												unifiedTool,
												profileKey,
												engine,
												engineTool,
												limit: limitBuckets,
											}),
											last6h: await telemetryStore.listRollups({
												tier: "last6h",
												unifiedTool,
												profileKey,
												engine,
												engineTool,
												limit: limitBuckets,
											}),
											last1d: await telemetryStore.listRollups({
												tier: "last1d",
												unifiedTool,
												profileKey,
												engine,
												engineTool,
												limit: limitBuckets,
											}),
										},
									}
								: {}),
						},
					};

					return {
						tool: toolName,
						success: true,
						message: `Inspected route hints for ${unifiedTool} (${profileKey}).`,
						items: [
							{
								id: `inspect-route-hints-${unifiedTool}-${profileKey}`,
								title: `${unifiedTool}:${profileKey}`,
								content: JSON.stringify(response, null, 2),
								score: 100,
								metadata: response,
							},
						],
						provenance: [
							{
								engine: "mimirmesh",
								tool: "inspect_route_hints",
								latencyMs: 0,
								health: telemetryStore ? "healthy" : "degraded",
							},
						],
						degraded: health.state !== "ready",
						warnings: health.warnings,
						warningCodes: [],
						raw: response,
					};
				}

				const profileKeys = telemetryStore ? await telemetryStore.listProfileKeys(unifiedTool) : [];
				const summaryProfiles =
					profileKeys.length > 0
						? profileKeys.map((currentProfileKey) => {
								const profileSnapshots = snapshots.filter(
									(snapshot) => snapshot.profileKey === currentProfileKey,
								);
								const primary = profileSnapshots[0];
								return {
									profileKey: currentProfileKey,
									subsetEligible,
									executionStrategy: routes[0] ? executionStrategyForRoute(routes[0]) : "fanout",
									sourceMode: primary?.sourceMode ?? "static",
									sourceLabel: primary?.sourceLabel ?? routeHintModeLabel("static"),
									freshnessState: primary?.freshnessState ?? "unknown",
									freshnessAgeSeconds: primary?.freshnessAgeSeconds ?? null,
									confidence: primary?.confidence ?? 0,
									sampleCount: primary?.sampleCount ?? 0,
									currentOrdering: buildOrdering(currentProfileKey, profileSnapshots),
								};
							})
						: [
								{
									profileKey: "seed-only",
									subsetEligible,
									executionStrategy: routes[0] ? executionStrategyForRoute(routes[0]) : "fanout",
									sourceMode: "static" as const,
									sourceLabel: routeHintModeLabel("static"),
									freshnessState: "unknown" as const,
									freshnessAgeSeconds: null,
									confidence: 0,
									sampleCount: 0,
									currentOrdering: buildOrdering(undefined, []),
								},
							];
				const response = {
					telemetryHealth: {
						state: health.state,
						lastSuccessfulCompactionAt: health.lastSuccessfulCompactionAt,
						lagSeconds: health.lagSeconds,
						warnings: health.warnings,
					},
					maintenanceStatus: health.maintenanceStatus,
					adaptiveSubset: allowlist,
					inspection: {
						unifiedTool,
						profileScope: "summary" as const,
						profiles: summaryProfiles,
					},
				};

				return {
					tool: toolName,
					success: true,
					message: `Inspected route hints for ${unifiedTool}.`,
					items: [
						{
							id: `inspect-route-hints-${unifiedTool}`,
							title: unifiedTool,
							content: JSON.stringify(response, null, 2),
							score: 100,
							metadata: response,
						},
					],
					provenance: [
						{
							engine: "mimirmesh",
							tool: "inspect_route_hints",
							latencyMs: 0,
							health: telemetryStore ? "healthy" : "degraded",
						},
					],
					degraded: health.state !== "ready",
					warnings: health.warnings,
					warningCodes: [],
					raw: response,
				};
			} finally {
				await telemetryStore?.close();
			}
		}
		const ignoreMatcher = await loadRepositoryIgnoreMatcher(this.projectRoot);
		const allowlist = resolveAdaptiveRouteHintAllowlist(this.config);
		const inputSummary = summarizeToolInput(toolName, input);
		const profileKey = buildRouteProfileKey(toolName, inputSummary);
		const requestFingerprint = buildRouteRequestFingerprint(toolName, inputSummary);
		const subsetEligible = allowlist.effectiveAllowlist.includes(toolName);
		const telemetryStore = runtime.connection?.services.includes("mm-postgres")
			? await openRouteTelemetryStore(this.projectRoot, this.config)
			: null;

		try {
			const hintSnapshots = telemetryStore
				? await telemetryStore.listRouteHintSnapshots({
						unifiedTool: toolName,
						profileKey,
					})
				: [];
			const snapshotsByKey = new Map(
				hintSnapshots.map((snapshot) => [routeSnapshotKey(snapshot), snapshot]),
			);
			const routes = unifiedRoutesFor(routingTable, toolName, {
				hintSnapshots: subsetEligible ? hintSnapshots : [],
			});
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

			const executeRoute = async (route: RoutingEngineRoute) => {
				const adapter = this.adapterResolver(route.engine);
				const translatedInput = this.translateToolInputForEngine(route.engine, input);
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
				const response = await this.engineInvoker({
					bridgePorts: runtime.connection?.bridgePorts ?? {},
					engine: route.engine,
					tool: route.engineTool,
					args: translatedPreparedInput,
				});
				return {
					route,
					response,
					latencyMs: Math.round(performance.now() - startedAt),
					inputBytes: jsonByteLength(translatedPreparedInput),
				};
			};

			const routeStepHasUsableOutput = (step: {
				route: RoutingEngineRoute;
				response: Awaited<ReturnType<typeof invokeEngineTool>>;
			}): boolean => {
				if (!step.response.ok) {
					return false;
				}
				const filteredPayload = filterIgnoredPayload(
					this.normalizePayloadForEngine(step.route.engine, step.response.result),
					this.projectRoot,
					ignoreMatcher,
				);
				if (filteredPayload === undefined) {
					return false;
				}
				return (
					toUsableResultItems(step.route.engine, step.route.engineTool, filteredPayload).length > 0
				);
			};

			let results: Array<{
				route: RoutingEngineRoute;
				response: Awaited<ReturnType<typeof invokeEngineTool>>;
				latencyMs: number;
				inputBytes: number;
			}>;

			if (routes.every((route) => executionStrategyForRoute(route) === "fallback-only")) {
				results = [];
				for (const route of routes) {
					const step = await executeRoute(route);
					results.push(step);
					if (routeStepHasUsableOutput(step)) {
						break;
					}
				}
			} else {
				const routeGroups = new Map<EngineId, typeof routes>();
				for (const route of routes) {
					const existing = routeGroups.get(route.engine) ?? [];
					existing.push(route);
					routeGroups.set(route.engine, existing);
				}

				const groupedResults = await Promise.all(
					[...routeGroups.entries()].map(async ([engine, engineRoutes]) => {
						const adapter = this.adapterResolver(engine);
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
									this.engineInvoker({
										bridgePorts: runtime.connection?.bridgePorts ?? {},
										engine,
										tool,
										args,
									}),
							});
							if (handled) {
								return handled.map((step) => ({
									route: {
										...step.route,
										unifiedTool: step.route.unifiedTool as RoutingEngineRoute["unifiedTool"],
									},
									response: step.response,
									latencyMs: step.latencyMs,
									inputBytes: jsonByteLength(translatedInput),
								}));
							}
						}

						return Promise.all(engineRoutes.map(executeRoute));
					}),
				);
				results = groupedResults.flat();
			}

			const provenance: ToolProvenance[] = [];
			const items: ToolResultItem[] = [];
			const warnings: string[] = [...allowlist.overrideWarnings];

			for (const [attemptIndex, result] of results.entries()) {
				const persistedAttemptIndex = attemptIndex + 1;
				const snapshot = snapshotsByKey.get(routeSnapshotKey(result.route));
				const orderingReasonCodes = snapshot?.subsetEligible
					? snapshot.sourceMode === "adaptive"
						? snapshot.orderingReasonCodes
						: [...new Set(["static_priority", snapshot.sourceMode])]
					: result.route.seedHint
						? ["seed_hint", "static_priority"]
						: ["static_priority"];
				const outputBytes = jsonByteLength(result.response.result);

				if (!result.response.ok) {
					warnings.push(`${result.route.engine}: ${result.response.error ?? "failed"}`);
					provenance.push({
						engine: result.route.engine,
						tool: result.route.engineTool,
						latencyMs: result.latencyMs,
						health: "unavailable",
						note: result.response.error,
					});
					if (telemetryStore) {
						await telemetryStore.recordRouteExecutionEvent({
							eventId: nowId("route-event"),
							repoId: telemetryStore.repoId,
							occurredAt: new Date().toISOString(),
							sessionId: this.sessionId,
							requestCorrelationId: null,
							unifiedTool: toolName,
							profileKey,
							sanitizedArgumentSummary: inputSummary,
							requestFingerprint,
							engine: result.route.engine,
							engineTool: result.route.engineTool,
							executionStrategy: executionStrategyForRoute(result.route),
							staticPriority: result.route.priority,
							attemptIndex: persistedAttemptIndex,
							outcome: "failed",
							failureClassification: failureClassificationFor(result.response.error),
							latencyMs: result.latencyMs,
							estimatedInputTokens: result.route.seedHint?.estimatedInputTokens ?? 0,
							estimatedOutputTokens: result.route.seedHint?.estimatedOutputTokens ?? 0,
							inputBytes: result.inputBytes,
							outputBytes,
							resultItemCount: 0,
							hintSourceModeAtExecution: snapshot?.sourceMode ?? "static",
							hintConfidenceAtExecution: snapshot?.confidence ?? 0,
							effectiveCostScoreAtExecution: snapshot?.effectiveCostScore ?? 0,
							orderingReasonCodes,
							createdAt: new Date().toISOString(),
						});
					}
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
					if (telemetryStore) {
						await telemetryStore.recordRouteExecutionEvent({
							eventId: nowId("route-event"),
							repoId: telemetryStore.repoId,
							occurredAt: new Date().toISOString(),
							sessionId: this.sessionId,
							requestCorrelationId: null,
							unifiedTool: toolName,
							profileKey,
							sanitizedArgumentSummary: inputSummary,
							requestFingerprint,
							engine: result.route.engine,
							engineTool: result.route.engineTool,
							executionStrategy: executionStrategyForRoute(result.route),
							staticPriority: result.route.priority,
							attemptIndex: persistedAttemptIndex,
							outcome: "degraded",
							failureClassification: "filtered",
							latencyMs: result.latencyMs,
							estimatedInputTokens: result.route.seedHint?.estimatedInputTokens ?? 0,
							estimatedOutputTokens: result.route.seedHint?.estimatedOutputTokens ?? 0,
							inputBytes: result.inputBytes,
							outputBytes,
							resultItemCount: 0,
							hintSourceModeAtExecution: snapshot?.sourceMode ?? "static",
							hintConfidenceAtExecution: snapshot?.confidence ?? 0,
							effectiveCostScoreAtExecution: snapshot?.effectiveCostScore ?? 0,
							orderingReasonCodes,
							createdAt: new Date().toISOString(),
						});
					}
					continue;
				}

				const routeItems = toUsableResultItems(
					result.route.engine,
					result.route.engineTool,
					filteredPayload,
				);
				if (routeItems.length === 0) {
					provenance.push({
						engine: result.route.engine,
						tool: result.route.engineTool,
						latencyMs: result.latencyMs,
						health: "healthy",
						note: "No usable items returned",
					});
					if (telemetryStore) {
						await telemetryStore.recordRouteExecutionEvent({
							eventId: nowId("route-event"),
							repoId: telemetryStore.repoId,
							occurredAt: new Date().toISOString(),
							sessionId: this.sessionId,
							requestCorrelationId: null,
							unifiedTool: toolName,
							profileKey,
							sanitizedArgumentSummary: inputSummary,
							requestFingerprint,
							engine: result.route.engine,
							engineTool: result.route.engineTool,
							executionStrategy: executionStrategyForRoute(result.route),
							staticPriority: result.route.priority,
							attemptIndex: persistedAttemptIndex,
							outcome: "degraded",
							failureClassification: "empty",
							latencyMs: result.latencyMs,
							estimatedInputTokens: result.route.seedHint?.estimatedInputTokens ?? 0,
							estimatedOutputTokens: result.route.seedHint?.estimatedOutputTokens ?? 0,
							inputBytes: result.inputBytes,
							outputBytes,
							resultItemCount: 0,
							hintSourceModeAtExecution: snapshot?.sourceMode ?? "static",
							hintConfidenceAtExecution: snapshot?.confidence ?? 0,
							effectiveCostScoreAtExecution: snapshot?.effectiveCostScore ?? 0,
							orderingReasonCodes,
							createdAt: new Date().toISOString(),
						});
					}
					continue;
				}
				items.push(...routeItems);
				provenance.push({
					engine: result.route.engine,
					tool: result.route.engineTool,
					latencyMs: result.latencyMs,
					health: "healthy",
				});
				if (telemetryStore) {
					await telemetryStore.recordRouteExecutionEvent({
						eventId: nowId("route-event"),
						repoId: telemetryStore.repoId,
						occurredAt: new Date().toISOString(),
						sessionId: this.sessionId,
						requestCorrelationId: null,
						unifiedTool: toolName,
						profileKey,
						sanitizedArgumentSummary: inputSummary,
						requestFingerprint,
						engine: result.route.engine,
						engineTool: result.route.engineTool,
						executionStrategy: executionStrategyForRoute(result.route),
						staticPriority: result.route.priority,
						attemptIndex: persistedAttemptIndex,
						outcome: "success",
						failureClassification: null,
						latencyMs: result.latencyMs,
						estimatedInputTokens: result.route.seedHint?.estimatedInputTokens ?? 0,
						estimatedOutputTokens: result.route.seedHint?.estimatedOutputTokens ?? 0,
						inputBytes: result.inputBytes,
						outputBytes,
						resultItemCount: routeItems.length,
						hintSourceModeAtExecution: snapshot?.sourceMode ?? "static",
						hintConfidenceAtExecution: snapshot?.confidence ?? 0,
						effectiveCostScoreAtExecution: snapshot?.effectiveCostScore ?? 0,
						orderingReasonCodes,
						createdAt: new Date().toISOString(),
					});
				}
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
					profileKey,
					requestFingerprint,
				},
			});
		} finally {
			await telemetryStore?.close();
		}
	}

	private async executePassthroughTool(
		toolName: string,
		input: ToolInput,
	): Promise<NormalizedToolResult> {
		const { runtime, session } = await this.resolveSessionState();
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

		const retiredAlias = retiredPassthroughAliasFor(runtime.routing, toolName);
		if (retiredAlias) {
			return this.augmentResultWarnings(
				buildRetiredPassthroughAliasResult({
					requestedAlias: toolName,
					route: retiredAlias.route,
					replacementName: retiredAlias.replacementName,
				}),
				{ engine: retiredAlias.route.engine },
			);
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

		const core = new Set(this.config.mcp.toolSurface.coreEngineGroups);
		const loaded = new Set(session.loadedEngineGroups);
		if (!core.has(route.engine) && !loaded.has(route.engine)) {
			if (this.config.mcp.toolSurface.allowInvocationLazyLoad) {
				try {
					await this.loadDeferredToolGroup(route.engine, "tool-invocation");
				} catch {
					// Keep the existing routing-table fallback for already-discovered routes even if
					// a live refresh cannot complete. This preserves direct invocation compatibility.
				}
			} else {
				return {
					tool: toolName,
					success: false,
					message: `${toolName} is deferred until ${route.engine} is loaded for this session.`,
					items: [],
					provenance: [],
					degraded: true,
					warnings: [`Run load_deferred_tools for ${route.engine} before invoking ${toolName}.`],
					warningCodes: [],
					nextAction: `Run \`mimirmesh mcp load-tools ${route.engine}\` and retry.`,
				};
			}
		}

		const adapter = this.adapterResolver(route.engine);
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
		const response = await this.engineInvoker({
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
		toolName: string;
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
		const discoverResponse = await this.engineInvoker({
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
				const validationResponse = await this.engineInvoker({
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
