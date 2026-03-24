import { afterEach, describe, expect, mock, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createDefaultConfig, type EngineUpgradeDecision } from "@mimirmesh/config";
import { createFixtureCopy } from "@mimirmesh/testing";
import { hashValue, persistBootstrapState, persistEngineState } from "../../src/state/io";

const installUpgradeDecisionTestDoubles = () => {
	mock.module("@mimirmesh/mcp-adapters", () => {
		const makeAdapter = (
			engine: "srclight" | "document-mcp" | "mcp-adr-analysis-server",
			bootstrapMode: "command" | "none",
		) => ({
			id: engine,
			namespace:
				engine === "srclight"
					? "mimirmesh.srclight"
					: engine === "document-mcp"
						? "mimirmesh.docs"
						: "mimirmesh.adr",
			bootstrap:
				bootstrapMode === "command"
					? {
							required: true,
							mode: "command" as const,
							command: "fixture",
							args: () => [],
						}
					: null,
			routingRules: [],
			resolveUnifiedRoutes: () => [],
			translateConfig: (_projectRoot: string, config: ReturnType<typeof createDefaultConfig>) => {
				const engineConfig = config.engines[engine];
				return {
					contract: {
						id: engine,
						namespace: engineConfig.namespace,
						serviceName: engineConfig.serviceName,
						required: engineConfig.required,
						dockerfile: engineConfig.image.dockerfile,
						context: engineConfig.image.context,
						imageTag: engineConfig.image.tag,
						bridgePort: engineConfig.bridge.containerPort,
						bridgeTransport: engine === "srclight" ? "sse" : "stdio",
						env: {
							ENGINE: engine,
							SERVICE: engineConfig.serviceName,
						},
						mounts: engineConfig.mounts,
					},
					errors: [],
					degraded: false,
				};
			},
		});

		const adapters = [
			makeAdapter("srclight", "command"),
			makeAdapter("document-mcp", "none"),
			makeAdapter("mcp-adr-analysis-server", "none"),
		];

		return {
			allEngineAdapters: adapters,
			getAdapter: (engine: string) => {
				const adapter = adapters.find((entry) => entry.id === engine);
				if (!adapter) {
					throw new Error(`Unknown engine adapter: ${engine}`);
				}
				return adapter;
			},
		};
	});
};

const loadUpgradeDecisionModules = async () => {
	mock.restore();
	installUpgradeDecisionTestDoubles();
	const module = await import(`../../src/upgrade/decisions?restore=${Date.now()}`);
	return { collectEngineUpgradeDecisions: module.collectEngineUpgradeDecisions };
};

describe("collectEngineUpgradeDecisions", () => {
	afterEach(() => {
		mock.restore();
	});

	test("marks incomplete required bootstrap for rebootstrap", async () => {
		const repo = await createFixtureCopy("single-ts");
		try {
			const { collectEngineUpgradeDecisions } = await loadUpgradeDecisionModules();
			const config = createDefaultConfig(repo);
			await persistEngineState(repo, {
				engine: "srclight",
				enabled: true,
				required: false,
				namespace: config.engines.srclight.namespace,
				serviceName: config.engines.srclight.serviceName,
				imageTag: config.engines.srclight.image.tag,
				configHash: hashValue({ ENGINE: "srclight", SERVICE: config.engines.srclight.serviceName }),
				discoveredTools: [],
				health: {
					state: "healthy",
					message: "healthy",
					checkedAt: "2026-03-14T00:00:00.000Z",
				},
				bridge: {
					url: "http://127.0.0.1:9999",
					transport: "sse",
					healthy: true,
					checkedAt: "2026-03-14T00:00:00.000Z",
				},
				lastStartupAt: "2026-03-14T00:00:00.000Z",
				lastBootstrapAt: null,
				lastBootstrapResult: "pending",
				capabilityWarnings: [],
				runtimeEvidence: {
					bootstrapMode: "command",
				},
			});
			await persistBootstrapState(repo, {
				updatedAt: "2026-03-14T00:00:00.000Z",
				engines: [
					{
						engine: "srclight",
						required: false,
						mode: "command",
						completed: false,
						bootstrapInputHash: "srclight-stale-hash",
						projectRootHash: "root-hash",
						lastStartedAt: "2026-03-14T00:00:00.000Z",
						lastCompletedAt: null,
						failureReason: null,
						retryCount: 0,
					},
				],
			});

			const decisions = await collectEngineUpgradeDecisions(repo, config);
			const srclightDecision = decisions.find(
				(entry: EngineUpgradeDecision) => entry.engine === "srclight",
			);

			expect(srclightDecision?.runtimeAction).toBe("rebootstrap");
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});
});
