import { access } from "node:fs/promises";
import { join } from "node:path";

import { readConfig } from "@mimirmesh/config";
import { createProjectLogger } from "@mimirmesh/logging";
import { createAdapters } from "@mimirmesh/mcp-adapters";
import {
	createToolRouter,
	isUnifiedTool,
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

export const startMcpServer = async (projectRootInput?: string): Promise<void> => {
	const projectRoot = projectRootInput ?? process.env.MIMIRMESH_PROJECT_ROOT ?? process.cwd();
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
		adapters,
		logger,
	});

	const server = new McpServer({
		name: "mimirmesh",
		version,
	});

	const passthroughSchema = z.object({}).passthrough();
	const toolDefinitions = await router.listTools();
	await logger.log(
		"mcp",
		"info",
		`Registering ${filterUnifiedTools(toolDefinitions).length} unified and ${filterPassthroughTools(toolDefinitions).length} passthrough tools`,
	);

	for (const tool of toolDefinitions) {
		const transportToolName = toTransportToolName(tool.name);
		const description =
			transportToolName === tool.name
				? tool.description
				: `${tool.description} (alias: ${tool.name})`;
		const inputSchema = isUnifiedTool(tool.name)
			? unifiedToolInputSchemas[tool.name]
			: passthroughSchema;

		server.registerTool(
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
