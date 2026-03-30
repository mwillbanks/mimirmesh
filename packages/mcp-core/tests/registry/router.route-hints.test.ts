import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { createDefaultConfig } from "@mimirmesh/config";
import {
	openRouteTelemetryStore,
	persistConnection,
	persistRoutingTable,
} from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";
import { startSkillRegistryRuntime } from "../../../../tests/_helpers/skills-runtime";
import { createToolRouter } from "../../src/registry/router";

const invokeEngineToolMock = mock(
	async (): Promise<{ ok: boolean; result?: unknown; error?: string }> => ({
		ok: true,
		result: {},
	}),
);

const getAdapterMock = mock((engine: string) => ({
	translateConfig: () => ({
		contract: {
			id: engine,
			namespace: engine === "srclight" ? "mimirmesh.srclight" : "mimirmesh.docs",
			serviceName: `mm-${engine}`,
			required: false,
			dockerfile: "Dockerfile",
			context: ".",
			imageTag: `mimirmesh/${engine}:test`,
			bridgePort: 0,
			bridgeTransport: engine === "srclight" ? ("sse" as const) : ("stdio" as const),
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

const buildRouter = (
	projectRoot: string,
	config: ReturnType<typeof createDefaultConfig>,
	sessionId?: string,
) =>
	createToolRouter({
		projectRoot,
		config,
		sessionId,
		adapterResolver: getAdapterMock as never,
		engineInvoker: invokeEngineToolMock as never,
	});

describe("router route hints", () => {
	beforeEach(() => {
		invokeEngineToolMock.mockReset();
		getAdapterMock.mockClear();
	});

	afterEach(() => {
		mock.restore();
	});

	test("executes fallback-only routes sequentially in static order when the first route fails", async () => {
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
			services: ["mm-srclight"],
			bridgePorts: {
				srclight: 65530,
			},
		});
		await persistRoutingTable(repo, {
			generatedAt: new Date().toISOString(),
			passthrough: [],
			unified: [
				{
					unifiedTool: "search_code",
					engine: "srclight",
					engineTool: "hybrid_search",
					priority: 150,
					executionStrategy: "fallback-only",
				},
				{
					unifiedTool: "search_code",
					engine: "srclight",
					engineTool: "semantic_search",
					priority: 145,
					executionStrategy: "fallback-only",
				},
			],
		});

		let releaseFirstRoute: (() => void) | null = null;
		invokeEngineToolMock.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					releaseFirstRoute = () => resolve({ ok: false, error: "hybrid failed" });
				}),
		);
		invokeEngineToolMock.mockResolvedValueOnce({ ok: true, result: { results: [{ id: 1 }] } });

		const router = buildRouter(repo, config);
		const pending = router.callTool("search_code", { query: "router" });

		for (let attempt = 0; attempt < 10 && !releaseFirstRoute; attempt += 1) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
		expect(invokeEngineToolMock).toHaveBeenCalledTimes(1);
		const release = releaseFirstRoute as (() => void) | null;
		if (!release) {
			throw new Error("expected the first route to still be pending");
		}
		release();

		const result = await pending;
		const [firstCall, secondCall] = invokeEngineToolMock.mock.calls as unknown as Array<
			[{ tool: string; args: Record<string, unknown> }]
		>;

		expect(result.success).toBe(true);
		expect(firstCall?.[0]).toMatchObject({ tool: "hybrid_search" });
		expect(secondCall?.[0]).toMatchObject({ tool: "semantic_search" });
		expect(invokeEngineToolMock).toHaveBeenCalledTimes(2);
	});

	test("keeps excluded allowlist tools on static ordering instead of adaptive reranking", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);
		config.mcp.routingHints.adaptiveSubset.exclude = ["search_code"];

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
			passthrough: [],
			unified: [
				{
					unifiedTool: "search_code",
					engine: "srclight",
					engineTool: "hybrid_search",
					priority: 150,
					executionStrategy: "fallback-only",
				},
				{
					unifiedTool: "search_code",
					engine: "srclight",
					engineTool: "semantic_search",
					priority: 145,
					executionStrategy: "fallback-only",
				},
			],
		});

		invokeEngineToolMock.mockResolvedValueOnce({ ok: true, result: { results: [{ id: 1 }] } });

		const router = buildRouter(repo, config);
		const result = await router.callTool("search_code", { query: "router" });
		const [firstCall] = invokeEngineToolMock.mock.calls as unknown as Array<
			[{ tool: string; args: Record<string, unknown> }]
		>;

		expect(result.success).toBe(true);
		expect(firstCall?.[0]).toMatchObject({ tool: "hybrid_search" });
		expect(invokeEngineToolMock).toHaveBeenCalledTimes(1);
	});

	test("continues fallback routing when the first ok response produces no usable items", async () => {
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
			services: ["mm-srclight"],
			bridgePorts: {
				srclight: 65530,
			},
		});
		await persistRoutingTable(repo, {
			generatedAt: new Date().toISOString(),
			passthrough: [],
			unified: [
				{
					unifiedTool: "search_code",
					engine: "srclight",
					engineTool: "search_symbols",
					priority: 150,
					executionStrategy: "fallback-only",
				},
				{
					unifiedTool: "search_code",
					engine: "srclight",
					engineTool: "semantic_search",
					priority: 150,
					executionStrategy: "fallback-only",
				},
			],
		});

		invokeEngineToolMock.mockResolvedValueOnce({ ok: true, result: { results: [] } });
		invokeEngineToolMock.mockResolvedValueOnce({
			ok: true,
			result: { results: [{ path: "packages/mcp-core/src/registry/router.ts" }] },
		});

		const router = buildRouter(repo, config);
		const result = await router.callTool("search_code", { query: "route telemetry maintenance" });
		const [firstCall, secondCall] = invokeEngineToolMock.mock.calls as unknown as Array<
			[{ tool: string; args: Record<string, unknown> }]
		>;

		expect(result.success).toBe(true);
		expect(result.items).toHaveLength(1);
		expect(firstCall?.[0]).toMatchObject({ tool: "search_symbols" });
		expect(secondCall?.[0]).toMatchObject({ tool: "semantic_search" });
		expect(invokeEngineToolMock).toHaveBeenCalledTimes(2);
	});

	test("continues fallback routing when the first ok response is an empty object envelope", async () => {
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
			services: ["mm-srclight"],
			bridgePorts: {
				srclight: 65530,
			},
		});
		await persistRoutingTable(repo, {
			generatedAt: new Date().toISOString(),
			passthrough: [],
			unified: [
				{
					unifiedTool: "search_code",
					engine: "srclight",
					engineTool: "search_symbols",
					priority: 150,
					executionStrategy: "fallback-only",
				},
				{
					unifiedTool: "search_code",
					engine: "srclight",
					engineTool: "semantic_search",
					priority: 150,
					executionStrategy: "fallback-only",
				},
			],
		});

		invokeEngineToolMock.mockResolvedValueOnce({ ok: true, result: {} });
		invokeEngineToolMock.mockResolvedValueOnce({
			ok: true,
			result: { results: [{ path: "packages/mcp-core/src/registry/router.ts" }] },
		});

		const router = buildRouter(repo, config);
		const result = await router.callTool("search_code", { query: "route telemetry maintenance" });
		const [firstCall, secondCall] = invokeEngineToolMock.mock.calls as unknown as Array<
			[{ tool: string; args: Record<string, unknown> }]
		>;

		expect(result.success).toBe(true);
		expect(result.items).toHaveLength(1);
		expect(firstCall?.[0]).toMatchObject({ tool: "search_symbols" });
		expect(secondCall?.[0]).toMatchObject({ tool: "semantic_search" });
		expect(invokeEngineToolMock).toHaveBeenCalledTimes(2);
	});

	test("continues fallback routing when the first ok response wraps an empty result object", async () => {
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
			services: ["mm-srclight"],
			bridgePorts: {
				srclight: 65530,
			},
		});
		await persistRoutingTable(repo, {
			generatedAt: new Date().toISOString(),
			passthrough: [],
			unified: [
				{
					unifiedTool: "search_code",
					engine: "srclight",
					engineTool: "search_symbols",
					priority: 150,
					executionStrategy: "fallback-only",
				},
				{
					unifiedTool: "search_code",
					engine: "srclight",
					engineTool: "semantic_search",
					priority: 150,
					executionStrategy: "fallback-only",
				},
			],
		});

		invokeEngineToolMock.mockResolvedValueOnce({ ok: true, result: { result: {} } });
		invokeEngineToolMock.mockResolvedValueOnce({
			ok: true,
			result: { results: [{ path: "packages/mcp-core/src/registry/router.ts" }] },
		});

		const router = buildRouter(repo, config);
		const result = await router.callTool("search_code", { query: "route telemetry maintenance" });
		const [firstCall, secondCall] = invokeEngineToolMock.mock.calls as unknown as Array<
			[{ tool: string; args: Record<string, unknown> }]
		>;

		expect(result.success).toBe(true);
		expect(result.items).toHaveLength(1);
		expect(firstCall?.[0]).toMatchObject({ tool: "search_symbols" });
		expect(secondCall?.[0]).toMatchObject({ tool: "semantic_search" });
		expect(invokeEngineToolMock).toHaveBeenCalledTimes(2);
	});

	test("records 1-based attempt indices for persisted fallback events", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);
		const runtime = await startSkillRegistryRuntime(repo, config);
		if (!runtime.available) {
			return;
		}

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
				services: ["mm-postgres", "mm-srclight"],
				bridgePorts: {
					srclight: 65530,
				},
			});
			await persistRoutingTable(repo, {
				generatedAt: new Date().toISOString(),
				passthrough: [],
				unified: [
					{
						unifiedTool: "search_code",
						engine: "srclight",
						engineTool: "search_symbols",
						priority: 150,
						executionStrategy: "fallback-only",
					},
					{
						unifiedTool: "search_code",
						engine: "srclight",
						engineTool: "semantic_search",
						priority: 150,
						executionStrategy: "fallback-only",
					},
				],
			});

			invokeEngineToolMock.mockResolvedValueOnce({ ok: false, error: "search symbols failed" });
			invokeEngineToolMock.mockResolvedValueOnce({
				ok: true,
				result: { results: [{ path: "packages/mcp-core/src/registry/router.ts" }] },
			});

			const router = buildRouter(repo, config, "router-route-hints-attempt-index");
			const result = await router.callTool("search_code", { query: "route telemetry maintenance" });
			expect(result.success).toBe(true);

			const store = await openRouteTelemetryStore(repo, config);
			expect(store).not.toBeNull();
			if (!store) {
				throw new Error("expected route telemetry store");
			}

			try {
				const events = await store.listRouteExecutionEvents({
					unifiedTool: "search_code",
				});
				const attemptIndices = events
					.filter((event) => event.sessionId === "router-route-hints-attempt-index")
					.sort((left, right) => left.attemptIndex - right.attemptIndex)
					.map((event) => event.attemptIndex);
				expect(attemptIndices).toEqual([1, 2]);
			} finally {
				await store.close();
			}
		} finally {
			await runtime.stop();
		}
	}, 120_000);
});
