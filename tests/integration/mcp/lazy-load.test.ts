import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";

import { createDefaultConfig } from "@mimirmesh/config";
import { persistConnection, persistRoutingTable } from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repoRoot = resolve(import.meta.dir, "..", "..", "..");
const serverEntry = join(repoRoot, "apps", "server", "src", "index.ts");

let bridgeServer: ReturnType<typeof Bun.serve> | null = null;
const activeClients: Array<{
	client: Client;
	transport: StdioClientTransport;
}> = [];

const reservePort = async (): Promise<number> =>
	new Promise((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			const port = typeof address === "object" && address ? address.port : null;
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				if (!port) {
					reject(new Error("Failed to reserve test port"));
					return;
				}
				resolve(port);
			});
		});
	});

const createConnectedClient = async (projectRoot: string) => {
	const transport = new StdioClientTransport({
		command: "bun",
		args: ["run", serverEntry],
		env: {
			...process.env,
			MIMIRMESH_PROJECT_ROOT: projectRoot,
		},
		stderr: "pipe",
		cwd: repoRoot,
	});
	const client = new Client(
		{
			name: "lazy-load-test-client",
			version: "1.0.0",
		},
		{
			capabilities: {},
		},
	);
	await client.connect(transport);
	const active = { client, transport };
	activeClients.push(active);
	return active;
};

afterEach(async () => {
	while (activeClients.length > 0) {
		const active = activeClients.pop();
		if (!active) {
			continue;
		}
		await active.client.close();
		await active.transport.close();
	}
	if (bridgeServer) {
		await bridgeServer.stop(true);
		bridgeServer = null;
	}
});

describe("lazy-loaded MCP integration", () => {
	test("keeps deferred passthrough tools hidden from another active session", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);
		const port = await reservePort();
		bridgeServer = Bun.serve({
			port,
			fetch(request) {
				const url = new URL(request.url);
				if (url.pathname === "/discover") {
					return Response.json({
						ok: true,
						tools: [
							{
								name: "search_symbols",
								description: "Search symbols",
								inputSchema: {
									type: "object",
									properties: {
										query: { type: "string" },
									},
								},
							},
						],
					});
				}
				if (url.pathname === "/health") {
					return Response.json({
						ok: true,
						ready: true,
						child: { running: true },
					});
				}
				return new Response("not found", { status: 404 });
			},
		});

		try {
			await persistConnection(repo, {
				projectName: config.runtime.projectName,
				composeFile: config.runtime.composeFile,
				updatedAt: new Date().toISOString(),
				startedAt: new Date().toISOString(),
				mounts: {
					repository: repo,
					mimirmesh: `${repo}/.mimirmesh`,
				},
				services: ["mm-srclight"],
				bridgePorts: {
					srclight: port,
				},
			});
			await persistRoutingTable(repo, {
				generatedAt: new Date().toISOString(),
				passthrough: [
					{
						publicTool: "mimirmesh.srclight.search_symbols",
						engine: "srclight",
						engineTool: "search_symbols",
						description: "Search symbols",
						publication: {
							canonicalEngineId: "srclight",
							publishedTool: "srclight_search_symbols",
							retiredAliases: ["mimirmesh.srclight.search_symbols"],
						},
					},
				],
				unified: [],
			});

			const clientA = await createConnectedClient(repo);
			const clientB = await createConnectedClient(repo);

			const initialA = await clientA.client.listTools();
			const initialB = await clientB.client.listTools();
			expect(initialA.tools.some((tool) => tool.name === "srclight_search_symbols")).toBe(false);
			expect(initialB.tools.some((tool) => tool.name === "srclight_search_symbols")).toBe(false);

			await clientA.client.callTool({
				name: "load_deferred_tools",
				arguments: {
					engine: "srclight",
				},
			});

			const afterLoadA = await clientA.client.listTools();
			const afterLoadB = await clientB.client.listTools();
			expect(afterLoadA.tools.some((tool) => tool.name === "srclight_search_symbols")).toBe(true);
			expect(afterLoadB.tools.some((tool) => tool.name === "srclight_search_symbols")).toBe(false);
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	}, 30_000);
});
