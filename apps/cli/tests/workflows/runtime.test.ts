import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createRuntimeUpgradeFixture } from "@mimirmesh/testing";
import { executeWorkflowRun, type PresentationProfile } from "@mimirmesh/ui";

import { createRuntimeActionWorkflow, createRuntimeUpgradeStatusWorkflow } from "../../src/workflows/runtime";

const presentation: PresentationProfile = {
	mode: "direct-human",
	interactive: false,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "wide",
};

describe("runtime workflows", () => {
	const originalProjectRoot = process.env.MIMIRMESH_PROJECT_ROOT;

	afterEach(() => {
		process.env.MIMIRMESH_PROJECT_ROOT = originalProjectRoot;
	});

	test("captures runtime readiness evidence for status inspection", async () => {
		const fixture = await createRuntimeUpgradeFixture("current");
		try {
			process.env.MIMIRMESH_PROJECT_ROOT = fixture.repo;

			const finalState = await executeWorkflowRun(
				createRuntimeActionWorkflow("status"),
				presentation,
			);

			expect(["success", "degraded", "failed"]).toContain(finalState.phase);
			expect(finalState.steps.find((step) => step.id === "inspect-runtime")?.status).not.toBe(
				"pending",
			);
			expect(finalState.outcome?.evidence?.some((row) => row.label === "Runtime state")).toBe(true);
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	}, 120_000);

	test("classifies runtime upgrade drift with explicit blocked capabilities", async () => {
		const fixture = await createRuntimeUpgradeFixture("outdated");
		try {
			process.env.MIMIRMESH_PROJECT_ROOT = fixture.repo;

			const finalState = await executeWorkflowRun(
				createRuntimeUpgradeStatusWorkflow(),
				presentation,
			);

			expect(finalState.phase).toBe("degraded");
			expect(finalState.outcome?.message).toContain("upgrade");
			expect(finalState.outcome?.evidence?.some((row) => row.value === "outdated")).toBe(true);
		} finally {
			await rm(fixture.repo, { recursive: true, force: true });
		}
	}, 120_000);
});
