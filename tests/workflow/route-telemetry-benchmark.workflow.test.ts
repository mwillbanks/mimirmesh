import { describe, expect, test } from "bun:test";

import { createToolRouter } from "@mimirmesh/mcp-core";
import { openRouteTelemetryStore } from "@mimirmesh/runtime";

import {
	loadCliContext,
	mcpInspectRouteHints,
	runtimeAction,
	runtimeClearRouteTelemetry,
	runtimeCompactRouteTelemetry,
} from "../../apps/cli/src/lib/context";

type Scenario = {
	tool: "search_code" | "find_symbol";
	args: Record<string, unknown>;
	expectedStaticFirstRoute: string;
	expectedRerankedFirstRoute: string;
};

type BenchmarkMeasurement = {
	firstAttemptedRoute: string;
	firstSuccessfulRoute: string;
	timeToFirstSuccessMs: number;
	estimatedRouteCost: number;
	success: boolean;
};

type BenchmarkSummary = {
	tool: Scenario["tool"];
	profileKey: string;
	sourceMode: string;
	staticFirstRoute: string;
	rerankedFirstRoute: string;
	staticMedianLatencyMs: number;
	rerankedMedianLatencyMs: number;
	latencyImprovementPercent: number;
	staticEstimatedCostPerSuccess: number;
	rerankedEstimatedCostPerSuccess: number;
	costImprovementPercent: number;
	staticSuccessRate: number;
	rerankedSuccessRate: number;
};

const repo = process.env.MIMIRMESH_PROJECT_ROOT ?? process.cwd();
const measurementCount = 5;
const warmupCount = 20;

const scenarios: Scenario[] = [
	{
		tool: "search_code",
		args: {
			query: "operator facing hint labels",
			limit: 5,
		},
		expectedStaticFirstRoute: "search_symbols",
		expectedRerankedFirstRoute: "semantic_search",
	},
	{
		tool: "find_symbol",
		args: {
			query: "originalServerBin",
		},
		expectedStaticFirstRoute: "search_symbols",
		expectedRerankedFirstRoute: "get_symbol",
	},
];

const median = (values: number[]): number => {
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
	}
	return sorted[middle] ?? 0;
};

const average = (values: number[]): number =>
	values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);

const successRate = (measurements: BenchmarkMeasurement[]): number =>
	measurements.filter((measurement) => measurement.success).length /
	Math.max(1, measurements.length);

const improvementPercent = (baseline: number, candidate: number): number =>
	((baseline - candidate) / Math.max(1, baseline)) * 100;

const buildStaticConfig = (
	config: Awaited<ReturnType<typeof loadCliContext>>["config"],
	tool: Scenario["tool"],
) => {
	const staticConfig = structuredClone(config);
	staticConfig.mcp.routingHints.adaptiveSubset.exclude = Array.from(
		new Set([...(staticConfig.mcp.routingHints.adaptiveSubset.exclude ?? []), tool]),
	);
	return staticConfig;
};

const collectMeasurements = async (options: {
	projectRoot: string;
	config: Awaited<ReturnType<typeof loadCliContext>>["config"];
	tool: Scenario["tool"];
	args: Record<string, unknown>;
	profileKey: string;
	label: string;
	count: number;
}) => {
	const store = await openRouteTelemetryStore(options.projectRoot, options.config);
	expect(store).not.toBeNull();
	if (!store) {
		throw new Error("expected route telemetry store");
	}

	try {
		const measurements: BenchmarkMeasurement[] = [];
		for (let index = 0; index < options.count; index += 1) {
			const sessionId = `${options.tool}-${options.label}-${index}`;
			const router = createToolRouter({
				projectRoot: options.projectRoot,
				config: options.config,
				sessionId,
			});
			const result = await router.callTool(options.tool, options.args);
			expect(result.success).toBe(true);

			const events = (
				await store.listRouteExecutionEvents({
					unifiedTool: options.tool,
					profileKey: options.profileKey,
					limit: 400,
				})
			)
				.filter((event) => event.sessionId === sessionId)
				.sort((left, right) => left.attemptIndex - right.attemptIndex);
			const firstSuccessIndex = events.findIndex((event) => event.outcome === "success");
			expect(firstSuccessIndex).toBeGreaterThanOrEqual(0);
			if (firstSuccessIndex < 0) {
				throw new Error(`No successful telemetry event recorded for ${sessionId}.`);
			}

			const contributingEvents = events.slice(0, firstSuccessIndex + 1);
			measurements.push({
				firstAttemptedRoute: contributingEvents[0]?.engineTool ?? "unknown",
				firstSuccessfulRoute: contributingEvents.at(-1)?.engineTool ?? "unknown",
				timeToFirstSuccessMs: contributingEvents.reduce(
					(total, event) => total + event.latencyMs,
					0,
				),
				estimatedRouteCost: contributingEvents.reduce(
					(total, event) => total + event.estimatedInputTokens + event.estimatedOutputTokens,
					0,
				),
				success: result.success,
			});
		}
		return measurements;
	} finally {
		await store.close();
	}
};

const warmScenario = async (options: {
	projectRoot: string;
	config: Awaited<ReturnType<typeof loadCliContext>>["config"];
	tool: Scenario["tool"];
	args: Record<string, unknown>;
	count: number;
}) => {
	let profileKey: string | null = null;
	for (let index = 0; index < options.count; index += 1) {
		const router = createToolRouter({
			projectRoot: options.projectRoot,
			config: options.config,
			sessionId: `${options.tool}-warm-${index}`,
		});
		const result = await router.callTool(options.tool, options.args);
		expect(result.success).toBe(true);
		profileKey ??= String((result.raw as { profileKey?: string } | undefined)?.profileKey ?? "");
	}
	if (!profileKey) {
		throw new Error(`No profile key captured while warming ${options.tool}.`);
	}
	return profileKey;
};

describe("route telemetry benchmark harness", () => {
	test("reports live reranked latency and cost deltas plus restart persistence evidence", async () => {
		const context = await loadCliContext(repo);
		const status = await runtimeAction(context, "status");
		expect(["ready", "degraded"]).toContain(status.health.state);

		const summaries: BenchmarkSummary[] = [];
		const persistenceChecks: Array<{
			tool: Scenario["tool"];
			profileKey: string;
			storedEventCount: number;
			sanitizedOnly: boolean;
		}> = [];

		try {
			for (const scenario of scenarios) {
				await runtimeClearRouteTelemetry(context, {
					scope: "tool",
					unifiedTool: scenario.tool,
				});
				const profileKey = await warmScenario({
					projectRoot: context.projectRoot,
					config: context.config,
					tool: scenario.tool,
					args: scenario.args,
					count: warmupCount,
				});
				await runtimeCompactRouteTelemetry(context, {
					scope: "tool",
					unifiedTool: scenario.tool,
				});

				const inspectionResult = await mcpInspectRouteHints(context, {
					unifiedTool: scenario.tool,
					profile: profileKey,
				});
				const inspection = inspectionResult.raw as {
					inspection: {
						sourceMode: string;
						currentOrdering: Array<{ engineTool: string }>;
					};
				};
				const rerankedOrdering = inspection.inspection.currentOrdering.map(
					(entry) => entry.engineTool,
				);
				expect(inspection.inspection.sourceMode).toBe("mixed");
				expect(rerankedOrdering[0]).toBe(scenario.expectedRerankedFirstRoute);

				const staticMeasurements = await collectMeasurements({
					projectRoot: context.projectRoot,
					config: buildStaticConfig(context.config, scenario.tool),
					tool: scenario.tool,
					args: scenario.args,
					profileKey,
					label: "static",
					count: measurementCount,
				});
				const rerankedMeasurements = await collectMeasurements({
					projectRoot: context.projectRoot,
					config: context.config,
					tool: scenario.tool,
					args: scenario.args,
					profileKey,
					label: "reranked",
					count: measurementCount,
				});

				const store = await openRouteTelemetryStore(context.projectRoot, context.config);
				expect(store).not.toBeNull();
				if (!store) {
					throw new Error("expected route telemetry store");
				}
				try {
					const storedEvents = await store.listRouteExecutionEvents({
						unifiedTool: scenario.tool,
						profileKey,
						limit: 400,
					});
					persistenceChecks.push({
						tool: scenario.tool,
						profileKey,
						storedEventCount: storedEvents.length,
						sanitizedOnly: storedEvents.every(
							(event) =>
								typeof event.sanitizedArgumentSummary === "object" &&
								!Object.hasOwn(event.sanitizedArgumentSummary, "query") &&
								!Object.hasOwn(event.sanitizedArgumentSummary, "result"),
						),
					});
				} finally {
					await store.close();
				}

				summaries.push({
					tool: scenario.tool,
					profileKey,
					sourceMode: inspection.inspection.sourceMode,
					staticFirstRoute: staticMeasurements[0]?.firstAttemptedRoute ?? "unknown",
					rerankedFirstRoute: rerankedMeasurements[0]?.firstAttemptedRoute ?? "unknown",
					staticMedianLatencyMs: median(
						staticMeasurements.map((measurement) => measurement.timeToFirstSuccessMs),
					),
					rerankedMedianLatencyMs: median(
						rerankedMeasurements.map((measurement) => measurement.timeToFirstSuccessMs),
					),
					latencyImprovementPercent: improvementPercent(
						median(staticMeasurements.map((measurement) => measurement.timeToFirstSuccessMs)),
						median(rerankedMeasurements.map((measurement) => measurement.timeToFirstSuccessMs)),
					),
					staticEstimatedCostPerSuccess: average(
						staticMeasurements.map((measurement) => measurement.estimatedRouteCost),
					),
					rerankedEstimatedCostPerSuccess: average(
						rerankedMeasurements.map((measurement) => measurement.estimatedRouteCost),
					),
					costImprovementPercent: improvementPercent(
						average(staticMeasurements.map((measurement) => measurement.estimatedRouteCost)),
						average(rerankedMeasurements.map((measurement) => measurement.estimatedRouteCost)),
					),
					staticSuccessRate: successRate(staticMeasurements),
					rerankedSuccessRate: successRate(rerankedMeasurements),
				});
			}

			const scenariosByTool = new Map(scenarios.map((scenario) => [scenario.tool, scenario]));
			for (const summary of summaries) {
				const scenario = scenariosByTool.get(summary.tool);
				expect(scenario).toBeDefined();
				if (!scenario) {
					throw new Error(`Missing benchmark scenario for ${summary.tool}.`);
				}
				expect(summary.staticFirstRoute).toBe(scenario.expectedStaticFirstRoute);
				expect(summary.rerankedFirstRoute).toBe(scenario.expectedRerankedFirstRoute);
				expect(summary.latencyImprovementPercent).toBeGreaterThanOrEqual(20);
				expect(summary.costImprovementPercent).toBeGreaterThanOrEqual(15);
				expect(summary.rerankedSuccessRate).toBeGreaterThanOrEqual(summary.staticSuccessRate);
			}

			const restarted = await runtimeAction(context, "restart");
			expect(["ready", "degraded"]).toContain(restarted.health.state);

			const restartedContext = await loadCliContext(repo);
			for (const check of persistenceChecks) {
				const inspectionResult = await mcpInspectRouteHints(restartedContext, {
					unifiedTool: check.tool,
					profile: check.profileKey,
				});
				const inspection = inspectionResult.raw as {
					telemetryHealth: { state: string };
					inspection: { currentOrdering: unknown[] };
				};
				expect(inspection.telemetryHealth.state).toBe("ready");
				expect(inspection.inspection.currentOrdering.length).toBeGreaterThan(0);
				expect(check.storedEventCount).toBeGreaterThan(0);
				expect(check.sanitizedOnly).toBe(true);
			}

			console.info(
				JSON.stringify(
					{
						scenarioCount: summaries.length,
						warmupCount,
						measurementCount,
						initialHealthState: status.health.state,
						postRestartHealthState: restarted.health.state,
						summaries,
						persistenceChecks,
					},
					null,
					2,
				),
			);
		} finally {
			for (const scenario of scenarios) {
				await runtimeClearRouteTelemetry(context, {
					scope: "tool",
					unifiedTool: scenario.tool,
				});
			}
		}
	}, 240_000);
});
