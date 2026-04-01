import { describe, expect, test } from "bun:test";
import type { NormalizedToolResult } from "@mimirmesh/mcp-core";
import { executeWorkflowRun, type PresentationProfile } from "@mimirmesh/ui";
import { CommandRunner } from "../../src/lib/command-runner";
import { renderInkUntilExit } from "../../src/testing/render-ink";
import { renderSkillsFindResultPanel } from "../../src/ui/skills-find-result-panel";
import { createSkillsFindWorkflow } from "../../src/workflows/skills";

const baseContext = {
	projectRoot: "/repo",
	sessionId: "session",
	config: {},
	logger: {},
	router: {},
};

const presentation: PresentationProfile = {
	mode: "direct-human",
	interactive: false,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "wide",
};

const createToolResult = (overrides: Partial<NormalizedToolResult> = {}): NormalizedToolResult => ({
	tool: "skills.find",
	success: true,
	degraded: false,
	message: "Found 2 skill(s).",
	nextAction: "next",
	items: [
		{
			id: "item-1",
			title: "agent-execution-mode",
			content: "Complete execution discipline.",
			score: 100,
			metadata: {},
		},
		{
			id: "item-2",
			title: "mimirmesh-code-navigation",
			content: "Locate symbols and implementations.",
			score: 97,
			metadata: {},
		},
	],
	provenance: [{ engine: "mimirmesh", tool: "skills.find", latencyMs: 0, health: "healthy" }],
	warnings: ["duration_ms=161"],
	warningCodes: [],
	raw: { total: 2 },
	...overrides,
});

describe("skills workflows", () => {
	test("keeps healthy discovery results out of degraded phase when only telemetry warnings exist", async () => {
		const workflow = createSkillsFindWorkflow(
			{},
			{
				loadContext: async () => baseContext as never,
				callTool: async () => createToolResult(),
			},
		);

		const finalState = await executeWorkflowRun(workflow, presentation);

		expect(finalState.phase).toBe("success");
		expect(finalState.outcome?.kind).toBe("success");
		expect(finalState.outcome?.evidence).toEqual(
			expect.arrayContaining([
				{ label: "Tool", value: "skills.find" },
				{ label: "Items", value: "2" },
			]),
		);
	});

	test("renders discovered skill rows in the default human-readable output", async () => {
		const output = await renderInkUntilExit(
			<CommandRunner
				definition={createSkillsFindWorkflow(
					{},
					{
						loadContext: async () => baseContext as never,
						callTool: async () => createToolResult(),
					},
				)}
				presentation={presentation}
				renderResultPanel={renderSkillsFindResultPanel}
			/>,
			{ columns: 200 },
		);

		expect(output).toContain("[SUCCESS] Found 2 skill(s).");
		expect(output).toContain("Matching skills");
		expect(output).toContain("Skill");
		expect(output).toContain("Score  Summary");
		expect(output).toContain("agent-execution-mode");
		expect(output).toContain("Complete execution discipline.");
		expect(output).toContain("mimirmesh-code-navigation");
		expect(output).toContain("Locate symbols and implementations.");
	});
});
