import { describe, expect, test } from "bun:test";
import { executeWorkflowRun, type PresentationProfile } from "@mimirmesh/ui";

import type { NormalizedToolResult } from "../../packages/mcp-core/src";

const { buildSkillAuthoringPrompt } = await import("../../apps/cli/src/commands/skills/shared");
const {
	createSkillsAuthoringUpdateWorkflow,
	createSkillsCreateWorkflow,
	createSkillsFindWorkflow,
	createSkillsReadWorkflow,
	createSkillsRefreshWorkflow,
	createSkillsResolveWorkflow,
} = await import("../../apps/cli/src/workflows/skills");

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

const createToolResult = (tool: string, message: string, itemId: string): NormalizedToolResult => ({
	tool,
	success: true,
	degraded: false,
	message,
	nextAction: "next",
	items: [
		{
			id: itemId,
			title: `${tool}-item`,
			content: message,
			score: 1,
			metadata: {},
		},
	],
	provenance: [{ engine: "mimirmesh", tool, latencyMs: 0, health: "healthy" }],
	warnings: [],
	warningCodes: [],
	raw: { tool, message },
});

const executeWorkflow = async (workflow: Parameters<typeof executeWorkflowRun>[0]) => {
	const finalState = await executeWorkflowRun(workflow, presentation);
	return finalState.outcome;
};

describe("skills registry workflows", () => {
	test("find shapes the request deterministically", async () => {
		const calls: Array<{ toolName: string; request: Record<string, unknown> }> = [];
		const workflow = createSkillsFindWorkflow(
			{
				query: "code navigation",
				names: ["mimirmesh-code-navigation"],
				include: ["description", "summary"],
				limit: 5,
				offset: 1,
			},
			{
				loadContext: async () => baseContext as never,
				callTool: async (_context, toolName, request) => {
					calls.push({ toolName, request });
					return createToolResult(toolName, "found", "item-1");
				},
			},
		);

		const outcome = await executeWorkflow(workflow);

		expect(calls).toEqual([
			{
				toolName: "skills.find",
				request: {
					query: "code navigation",
					names: ["mimirmesh-code-navigation"],
					include: ["description", "summary"],
					limit: 5,
					offset: 1,
				},
			},
		]);
		expect(outcome?.kind).toBe("success");
		expect(outcome?.machineReadablePayload).toMatchObject({
			tool: "skills.find",
			request: {
				query: "code navigation",
				names: ["mimirmesh-code-navigation"],
				include: ["description", "summary"],
				limit: 5,
				offset: 1,
			},
		});
	});

	test("read and resolve shape their requests deterministically", async () => {
		const calls: Array<{ toolName: string; request: Record<string, unknown> }> = [];
		const workflow = createSkillsReadWorkflow(
			{
				name: "mimirmesh-code-navigation",
				mode: "instructions",
				include: ["instructions", "referencesIndex"],
				select: { instructions: ["overview"] },
			},
			{
				loadContext: async () => baseContext as never,
				callTool: async (_context, toolName, request) => {
					calls.push({ toolName, request });
					return createToolResult(toolName, "read", "item-1");
				},
			},
		);

		const resolveWorkflow = createSkillsResolveWorkflow(
			{
				prompt: "refine the skill install workflow",
				taskMetadata: { priority: "high" },
				mcpEngineContext: { engine: "srclight" },
				include: ["matchReason", "readHint"],
				limit: 3,
			},
			{
				loadContext: async () => baseContext as never,
				callTool: async (_context, toolName, request) => {
					calls.push({ toolName, request });
					return createToolResult(toolName, "resolved", "item-2");
				},
			},
		);

		await executeWorkflow(workflow);
		await executeWorkflow(resolveWorkflow);

		expect(calls).toEqual([
			{
				toolName: "skills.read",
				request: {
					name: "mimirmesh-code-navigation",
					mode: "instructions",
					include: ["instructions", "referencesIndex"],
					select: { instructions: ["overview"] },
				},
			},
			{
				toolName: "skills.resolve",
				request: {
					prompt: "refine the skill install workflow",
					taskMetadata: { priority: "high" },
					mcpEngineContext: { engine: "srclight" },
					include: ["matchReason", "readHint"],
					limit: 3,
				},
			},
		]);
	});

	test("refresh and authoring workflows apply deterministic defaults", async () => {
		const calls: Array<{ toolName: string; request: Record<string, unknown> }> = [];

		const refreshWorkflow = createSkillsRefreshWorkflow(
			{
				names: ["mimirmesh-code-navigation"],
				scope: "repo",
				invalidateNotFound: true,
				reindexEmbeddings: false,
			},
			{
				loadContext: async () => baseContext as never,
				callTool: async (_context, toolName, request) => {
					calls.push({ toolName, request });
					return createToolResult(toolName, "refreshed", "item-3");
				},
			},
		);

		const createWorkflow = createSkillsCreateWorkflow(
			{
				prompt: undefined,
				mode: undefined,
				includeRecommendations: undefined,
				includeGapAnalysis: undefined,
				includeCompletenessAnalysis: undefined,
				includeConsistencyAnalysis: undefined,
				validateBeforeWrite: undefined,
			},
			{
				loadContext: async () => baseContext as never,
				callTool: async (_context, toolName, request) => {
					calls.push({ toolName, request });
					return createToolResult(toolName, "created", "item-4");
				},
			},
		);

		const updateWorkflow = createSkillsAuthoringUpdateWorkflow(
			{
				name: "custom-skill",
				prompt: undefined,
				mode: undefined,
				includeRecommendations: undefined,
				includeGapAnalysis: undefined,
				includeCompletenessAnalysis: undefined,
				includeConsistencyAnalysis: undefined,
				validateBeforeWrite: undefined,
				validateAfterWrite: undefined,
			},
			{
				loadContext: async () => baseContext as never,
				callTool: async (_context, toolName, request) => {
					calls.push({ toolName, request });
					return createToolResult(toolName, "updated", "item-5");
				},
			},
		);

		await executeWorkflow(refreshWorkflow);
		await executeWorkflow(createWorkflow);
		await executeWorkflow(updateWorkflow);

		expect(calls).toEqual([
			{
				toolName: "skills.refresh",
				request: {
					names: ["mimirmesh-code-navigation"],
					scope: "repo",
					invalidateNotFound: true,
					reindexEmbeddings: false,
				},
			},
			{
				toolName: "skills.create",
				request: {
					prompt: buildSkillAuthoringPrompt("create"),
					mode: "generate",
					includeRecommendations: true,
					includeGapAnalysis: true,
					includeCompletenessAnalysis: true,
					includeConsistencyAnalysis: true,
					validateBeforeWrite: true,
				},
			},
			{
				toolName: "skills.update",
				request: {
					name: "custom-skill",
					prompt: buildSkillAuthoringPrompt("update", "custom-skill"),
					mode: "patchPlan",
					includeRecommendations: true,
					includeGapAnalysis: true,
					includeCompletenessAnalysis: true,
					includeConsistencyAnalysis: true,
					validateBeforeWrite: true,
					validateAfterWrite: true,
				},
			},
		]);
	});
});
