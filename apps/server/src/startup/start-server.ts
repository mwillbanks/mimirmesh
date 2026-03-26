import { access } from "node:fs/promises";
import { join } from "node:path";

import { readConfig } from "@mimirmesh/config";
import { createProjectLogger } from "@mimirmesh/logging";
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
	loadExecutableBuildManifest,
	persistMcpServerSession,
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
import { filterUnifiedTools } from "../tools/unified";

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
	structuredContent?: {
		result: unknown;
	};
	isError?: boolean;
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

	for (const tool of toolDefinitions) {
		const transportToolName = toTransportToolName(tool.name);
		const description =
			transportToolName === tool.name
				? tool.description
				: `${tool.description} (alias: ${tool.name})`;
		const inputSchema: McpAnySchema | ZodRawShapeCompat = isUnifiedTool(tool.name)
			? (unifiedToolInputSchemas[tool.name] as unknown as ZodRawShapeCompat)
			: (passthroughSchema as unknown as McpAnySchema);

		registerTransportTool(
			transportToolName,
			{
				title: transportToolName,
				description,
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
					structuredContent: {
						result,
					},
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

	const closeServer = async () => {
		await logger.log("mcp", "info", "Shutting down MCP server.");
		await clearMcpServerSession(projectRoot, process.pid);
		await server.close();
		process.exit(0);
	};

	process.on("SIGINT", closeServer);
	process.on("SIGTERM", closeServer);
};
