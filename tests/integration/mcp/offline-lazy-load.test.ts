import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { createDefaultConfig } from "@mimirmesh/config";
import { persistConnection, persistRoutingTable } from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repoRoot = resolve(import.meta.dir, "..", "..", "..");
const serverEntry = join(repoRoot, "apps", "server", "src", "index.ts");

const activeClients: Array<{
	client: Client;
	transport: StdioClientTransport;
}> = [];

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
			name: "offline-lazy-load-test-client",
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
});

describe("offline deferred-load integration", () => {
	test("returns a clear error when the deferred engine bridge is unavailable", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);

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
			const result = await active.client.callTool({
				name: "load_deferred_tools",
				arguments: {
					engine: "srclight",
				},
			});
			expect(result.isError).toBe(true);
			expect(JSON.stringify(result.structuredContent ?? result.content)).toContain(
				"Unable to connect",
			);
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	}, 30_000);
});
