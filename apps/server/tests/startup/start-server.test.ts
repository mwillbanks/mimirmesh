import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { persistConnection, persistRoutingTable } from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repoRoot = resolve(import.meta.dir, "..", "..", "..", "..");
const serverEntry = join(repoRoot, "apps", "server", "src", "index.ts");

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
			name: "startup-test-client",
			version: "1.0.0",
		},
		{
			capabilities: {},
		},
	);
	await client.connect(transport);
	return {
		client,
		transport,
	};
};

const activeClients: Array<Awaited<ReturnType<typeof createConnectedClient>>> = [];

afterEach(async () => {
	while (activeClients.length > 0) {
		const active = activeClients.pop();
		if (!active) {
			continue;
		}
		await active.client.close();
		await active.transport.close();
	}
});

describe("server startup MCP publication", () => {
	test("publishes engine-native passthrough names and hides retired aliases from listTools", async () => {
		const repo = await createFixtureCopy("single-ts");

		try {
			await persistConnection(repo, {
				projectName: "startup-test",
				composeFile: join(repo, ".mimirmesh", "runtime", "docker-compose.yml"),
				updatedAt: new Date().toISOString(),
				startedAt: new Date().toISOString(),
				mounts: {
					repository: repo,
					mimirmesh: `${repo}/.mimirmesh`,
				},
				services: ["mm-srclight"],
				bridgePorts: {
					srclight: 65530,
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

			const active = await createConnectedClient(repo);
			activeClients.push(active);

			const listed = await active.client.listTools();
			expect(listed.tools.some((tool) => tool.name === "srclight_search_symbols")).toBe(true);
			expect(listed.tools.some((tool) => tool.name === "mimirmesh_srclight_search_symbols")).toBe(
				false,
			);

			const retired = await active.client.callTool({
				name: "mimirmesh_srclight_search_symbols",
				arguments: {
					query: "ToolRouter",
				},
			});
			expect(retired.isError).toBe(true);
			expect(JSON.stringify(retired.structuredContent ?? retired.content)).toContain(
				"srclight_search_symbols",
			);
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	}, 30_000);
});
