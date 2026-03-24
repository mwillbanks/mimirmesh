import { afterEach, describe, expect, mock, test } from "bun:test";
import { rm } from "node:fs/promises";

type AdapterFixtureConfig = {
	engines: Record<
		string,
		{
			namespace: string;
			serviceName: string;
			required: boolean;
			image: {
				dockerfile: string;
				context: string;
				tag: string;
			};
			bridge: {
				containerPort: number;
			};
			settings: unknown;
			mounts: {
				repo: string;
				mimirmesh: string;
			};
		}
	>;
};

const installAdapterTestDoubles = () => {
	mock.module("@mimirmesh/mcp-adapters", () => {
		const normalizePassthroughToolSegment = (tool: string): string =>
			tool
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9_-]+/g, "_")
				.replace(/^_+|_+$/g, "") || "tool";

		const makeAdapter = (
			engine: "srclight" | "document-mcp" | "mcp-adr-analysis-server",
			bootstrapMode: "tool" | "command" | "none",
		) => ({
			id: engine,
			namespace:
				engine === "srclight"
					? "mimirmesh.srclight"
					: engine === "document-mcp"
						? "mimirmesh.docs"
						: "mimirmesh.adr",
			passthroughPublication: {
				canonicalId:
					engine === "srclight" ? "srclight" : engine === "document-mcp" ? "docs" : "adr",
				eligibleForPublication: true,
			},
			bootstrap:
				bootstrapMode === "command"
					? {
							required: true,
							mode: "command" as const,
							command: "fixture",
							args: () => [],
						}
					: bootstrapMode === "tool"
						? {
								required: true,
								mode: "tool" as const,
								tool: "fixture",
								args: () => ({}),
							}
						: null,
			routingRules: [],
			resolveUnifiedRoutes: () => [],
			translateConfig: (_projectRoot: string, config: AdapterFixtureConfig) => {
				const engineConfig = config.engines[engine];
				if (!engineConfig) {
					throw new Error(`Missing engine config for ${engine}`);
				}
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
							SETTINGS: JSON.stringify(engineConfig.settings),
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
			buildLegacyPassthroughToolName: (namespace: string, tool: string) =>
				`${namespace}.${normalizePassthroughToolSegment(tool)}`,
			buildPublishedPassthroughToolName: (canonicalId: string, tool: string) =>
				`${canonicalId}_${normalizePassthroughToolSegment(tool)}`,
			getAdapter: (engine: string) => {
				const adapter = adapters.find((entry) => entry.id === engine);
				if (!adapter) {
					throw new Error(`Unknown engine adapter: ${engine}`);
				}
				return adapter;
			},
			translateAllEngineConfigs: (projectRoot: string, config: AdapterFixtureConfig) =>
				adapters.map((adapter) => adapter.translateConfig(projectRoot, config)),
		};
	});
};

const loadUpgradeTestModules = async () => {
	mock.restore();
	installAdapterTestDoubles();
	const [{ createRuntimeUpgradeFixture }, { classifyUpgradeStatus }] = await Promise.all([
		import("@mimirmesh/testing"),
		import("../../src/upgrade/status"),
	]);
	return { createRuntimeUpgradeFixture, classifyUpgradeStatus };
};

describe("runtime upgrade status", () => {
	afterEach(() => {
		mock.restore();
	});

	test("classifies current runtime", async () => {
		const { createRuntimeUpgradeFixture, classifyUpgradeStatus } = await loadUpgradeTestModules();
		const fixture = await createRuntimeUpgradeFixture("current");
		try {
			const status = await classifyUpgradeStatus(fixture.repo, fixture.config);
			expect(status.report.state).toBe("current");
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});

	test("classifies outdated runtime", async () => {
		const { createRuntimeUpgradeFixture, classifyUpgradeStatus } = await loadUpgradeTestModules();
		const fixture = await createRuntimeUpgradeFixture("outdated");
		try {
			const status = await classifyUpgradeStatus(fixture.repo, fixture.config);
			expect(status.report.state).toBe("outdated");
			expect(status.report.requiredActions).toContain("migrate-state");
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});

	test("requires a runtime restart when engine definitions drift without a schema migration", async () => {
		const { createRuntimeUpgradeFixture, classifyUpgradeStatus } = await loadUpgradeTestModules();
		const fixture = await createRuntimeUpgradeFixture("current");
		try {
			fixture.config.engines.srclight.image.tag = "mimirmesh/srclight:fixture-restart";

			const status = await classifyUpgradeStatus(fixture.repo, fixture.config);
			expect(status.report.state).toBe("outdated");
			expect(status.report.requiredActions).toContain("restart-runtime");
			expect(status.report.requiredActions).not.toContain("migrate-state");
			expect(status.report.driftCategories).toContain("compose-definition");
			expect(status.report.driftCategories).toContain("engine-image");
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});

	test("classifies blocked runtime outside compatibility window", async () => {
		const { createRuntimeUpgradeFixture, classifyUpgradeStatus } = await loadUpgradeTestModules();
		const fixture = await createRuntimeUpgradeFixture("blocked");
		try {
			const status = await classifyUpgradeStatus(fixture.repo, fixture.config);
			expect(status.report.state).toBe("blocked");
			expect(status.report.requiredActions).toContain("manual-intervention");
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});

	test("classifies degraded runtime with quarantined preserved assets", async () => {
		const { createRuntimeUpgradeFixture, classifyUpgradeStatus } = await loadUpgradeTestModules();
		const fixture = await createRuntimeUpgradeFixture("degraded");
		try {
			const status = await classifyUpgradeStatus(fixture.repo, fixture.config);
			expect(status.report.state).toBe("degraded");
			expect(status.report.driftCategories).toContain("preserved-asset-validation");
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	});
});
