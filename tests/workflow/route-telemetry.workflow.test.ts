import { describe, expect, test } from "bun:test";
import { executeWorkflowRun, type PresentationProfile } from "@mimirmesh/ui";
import {
	createRuntimeTelemetryClearWorkflow,
	createRuntimeTelemetryCompactWorkflow,
} from "../../apps/cli/src/workflows/runtime";

const presentation: PresentationProfile = {
	mode: "direct-human",
	interactive: false,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "wide",
};

describe("route telemetry workflows", () => {
	test("reports compact and clear workflow payloads through the shared runtime context", async () => {
		const loadContext = async () =>
			({
				projectRoot: "/repo",
				sessionId: "workflow-route-telemetry",
				config: {},
				logger: {},
				router: {},
			}) as never;
		const compactState = await executeWorkflowRun(
			createRuntimeTelemetryCompactWorkflow(
				{
					scope: "tool",
					unifiedTool: "search_code",
				},
				{
					loadContext,
					compactTelemetry: async () => ({
						acquired: true,
						progress: {
							closedBucketCount: 3,
							remainingBucketCount: 0,
							lastProcessedBucketEnd: "2026-03-28T12:00:00.000Z",
						},
						affectedSourceLabels: ["adaptive"],
						maintenanceState: {
							repoId: "repo",
							lastStartedAt: "2026-03-28T12:00:00.000Z",
							lastCompletedAt: "2026-03-28T12:00:05.000Z",
							lastSuccessfulAt: "2026-03-28T12:00:05.000Z",
							lastCompactedThrough: "2026-03-28T12:00:00.000Z",
							status: "idle",
							lagSeconds: 0,
							lastError: null,
							lockOwner: null,
						},
					}),
				},
			),
			presentation,
		);
		const clearState = await executeWorkflowRun(
			createRuntimeTelemetryClearWorkflow(
				{
					scope: "tool",
					unifiedTool: "search_code",
				},
				{
					loadContext,
					clearTelemetry: async () => ({
						scope: { scope: "tool", unifiedTool: "search_code" },
						clearedAt: "2026-03-28T12:10:00.000Z",
					}),
				},
			),
			presentation,
		);

		expect(compactState.phase).toBe("success");
		expect(
			(
				compactState.outcome?.machineReadablePayload as {
					progress?: { closedBucketCount?: number };
				}
			)?.progress?.closedBucketCount,
		).toBe(3);
		expect(clearState.phase).toBe("success");
		expect(
			(clearState.outcome?.machineReadablePayload as { scope?: { unifiedTool?: string } })?.scope
				?.unifiedTool,
		).toBe("search_code");
	});

	test("surfaces degraded compaction runs when another maintainer holds the advisory lock", async () => {
		const loadContext = async () =>
			({
				projectRoot: "/repo",
				sessionId: "workflow-route-telemetry-degraded",
				config: {},
				logger: {},
				router: {},
			}) as never;
		const compactState = await executeWorkflowRun(
			createRuntimeTelemetryCompactWorkflow(
				{
					scope: "repo",
				},
				{
					loadContext,
					compactTelemetry: async () => ({
						acquired: false,
						progress: {
							closedBucketCount: 0,
							remainingBucketCount: 1,
							lastProcessedBucketEnd: null,
						},
						affectedSourceLabels: [],
						maintenanceState: {
							repoId: "repo",
							lastStartedAt: "2026-03-28T12:00:00.000Z",
							lastCompletedAt: null,
							lastSuccessfulAt: "2026-03-28T11:45:00.000Z",
							lastCompactedThrough: "2026-03-28T11:45:00.000Z",
							status: "running",
							lagSeconds: 900,
							lastError: null,
							lockOwner: "other-maintainer",
						},
					}),
				},
			),
			presentation,
		);

		expect(compactState.phase).toBe("degraded");
		expect((compactState.outcome?.machineReadablePayload as { acquired?: boolean })?.acquired).toBe(
			false,
		);
		expect(compactState.outcome?.message).toContain("Skipped route telemetry compaction");
	});
});
