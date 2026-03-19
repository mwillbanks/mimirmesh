import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import type { ToolDefinition } from "@mimirmesh/mcp-core";
import { detectDockerAvailability } from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";
import { loadCliContext, mcpCallTool, mcpListTools, runtimeAction } from "apps/cli/src/lib/context";

describe("integration mcp", () => {
	test("lists tools and invokes unified+passthrough", async () => {
		const docker = await detectDockerAvailability();
		if (!docker.dockerInstalled || !docker.dockerDaemonRunning || !docker.composeAvailable) {
			return;
		}

		const repo = await createFixtureCopy("single-ts", { initializeGit: true });
		const context = await loadCliContext(repo);
		try {
			await runtimeAction(context, "start");

			const tools = (await mcpListTools(context)) as ToolDefinition[];
			expect(Array.isArray(tools)).toBe(true);
			const srclightPassthrough = tools.find((tool) => tool.name.startsWith("mimirmesh.srclight."));
			const retiredTool = tools.find(
				(tool) =>
					tool.name.startsWith("mimirmesh.codebase.") || tool.name.includes("codebase-memory"),
			);
			const hasUnifiedSearch = tools.some((tool) => tool.name === "search_code");
			const hasFindTests = tools.some((tool) => tool.name === "find_tests");
			const hasInspectPlatform = tools.some((tool) => tool.name === "inspect_platform_code");
			const hasListWorkspaceProjects = tools.some(
				(tool) => tool.name === "list_workspace_projects",
			);
			const hasRefreshIndex = tools.some((tool) => tool.name === "refresh_index");
			const status = await runtimeAction(context, "status");

			expect(srclightPassthrough).toBeDefined();
			expect(retiredTool).toBeUndefined();
			expect(hasFindTests).toBe(true);
			expect(hasInspectPlatform).toBe(true);
			expect(hasListWorkspaceProjects).toBe(true);
			expect(hasRefreshIndex).toBe(true);
			if (!srclightPassthrough) {
				throw new Error("Expected a discovered Srclight passthrough tool");
			}

			if (hasUnifiedSearch) {
				const unified = await mcpCallTool(context, "search_code", { query: "export" });
				expect(Array.isArray(unified.provenance)).toBe(true);
			}
			if (hasFindTests) {
				const unified = await mcpCallTool(context, "find_tests", { query: "main" });
				expect(Array.isArray(unified.provenance)).toBe(true);
			}
			if (hasInspectPlatform) {
				const unified = await mcpCallTool(context, "inspect_platform_code", {});
				expect(Array.isArray(unified.provenance)).toBe(true);
			}
			if (hasListWorkspaceProjects) {
				const unified = await mcpCallTool(context, "list_workspace_projects", {});
				expect(Array.isArray(unified.provenance)).toBe(true);
			}
			if (hasRefreshIndex) {
				const unified = await mcpCallTool(context, "refresh_index", {});
				expect(Array.isArray(unified.provenance)).toBe(true);
			}

			const passthrough = await mcpCallTool(
				context,
				srclightPassthrough.name as `mimirmesh.${string}`,
				{
					query: "export",
					symbol: "export",
				},
			);
			expect(Array.isArray(passthrough.provenance)).toBe(true);
			expect(
				passthrough.provenance.some((entry: { engine?: string }) => entry.engine === "srclight"),
			).toBe(true);
			expect(["ready", "degraded", "bootstrapping"]).toContain(status.health.state);
		} finally {
			await runtimeAction(context, "stop");
			await rm(repo, { recursive: true, force: true });
		}
	}, 120_000);
});
