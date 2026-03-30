import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { createDefaultConfig } from "@mimirmesh/config";
import { persistConnection, persistRoutingTable } from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";
import { createToolRouter } from "../../src/registry/router";

const invokeEngineToolMock = mock(
	async (): Promise<{ ok: boolean; result?: unknown; error?: string }> => ({
		ok: true,
		result: { results: [{ id: 1 }] },
	}),
);

const getAdapterMock = mock((engine: string) => ({
	translateConfig: () => ({
		contract: {
			id: engine,
			namespace: engine,
			serviceName: `mm-${engine}`,
			required: false,
			dockerfile: "Dockerfile",
			context: ".",
			imageTag: `mimirmesh/${engine}:test`,
			bridgePort: 0,
			bridgeTransport: "stdio" as const,
			env: {},
			mounts: {
				repo: "/workspace",
				mimirmesh: "/mimirmesh",
			},
		},
		errors: [],
		degraded: false,
	}),
	prepareToolInput: (_toolName: string, input: Record<string, unknown>) => input,
}));

const buildRouter = (projectRoot: string, config: ReturnType<typeof createDefaultConfig>) =>
	createToolRouter({
		projectRoot,
		config,
		adapterResolver: getAdapterMock as never,
		engineInvoker: invokeEngineToolMock as never,
	});

describe("router merge strategy", () => {
	beforeEach(() => {
		invokeEngineToolMock.mockReset();
		invokeEngineToolMock.mockResolvedValue({ ok: true, result: { results: [{ id: 1 }] } });
		getAdapterMock.mockClear();
	});

	afterEach(() => {
		mock.restore();
	});

	test("preserves fanout execution for non-allowlisted merge-oriented tools", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);

		await persistConnection(repo, {
			projectName: config.runtime.projectName,
			composeFile: config.runtime.composeFile,
			updatedAt: new Date().toISOString(),
			startedAt: new Date().toISOString(),
			mounts: {
				repository: repo,
				mimirmesh: `${repo}/.mimirmesh`,
			},
			services: ["mm-document-mcp", "mm-mcp-adr-analysis-server"],
			bridgePorts: {
				"document-mcp": 65531,
				"mcp-adr-analysis-server": 65532,
			},
		});
		await persistRoutingTable(repo, {
			generatedAt: new Date().toISOString(),
			passthrough: [],
			unified: [
				{
					unifiedTool: "document_architecture",
					engine: "document-mcp",
					engineTool: "search_documents",
					priority: 80,
					executionStrategy: "fanout",
				},
				{
					unifiedTool: "document_architecture",
					engine: "mcp-adr-analysis-server",
					engineTool: "get_architectural_context",
					priority: 110,
					executionStrategy: "fanout",
				},
			],
		});

		const router = buildRouter(repo, config);
		const result = await router.callTool("document_architecture", {
			query: "runtime boundaries",
		});

		expect(result.success).toBe(true);
		expect(invokeEngineToolMock).toHaveBeenCalledTimes(2);
		expect(
			(result.raw as { routes?: Array<{ executionStrategy?: string }> }).routes?.every(
				(route) => route.executionStrategy === "fanout",
			),
		).toBe(true);
	});
});
