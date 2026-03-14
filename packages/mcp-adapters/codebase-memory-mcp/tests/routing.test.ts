import { describe, expect, test } from "bun:test";

import type { UnifiedExecutionContext } from "../../src/types";

import { executeCodebaseUnifiedTool, resolveCodebaseRoutes } from "../src/routing";

describe("codebase-memory unified routing", () => {
	test("maps discovered tools to unified friendly routes", () => {
		const routes = resolveCodebaseRoutes([
			{ name: "search_graph" },
			{ name: "get_code_snippet" },
			{ name: "trace_call_path" },
			{ name: "search_code" },
		]);

		expect(routes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ unifiedTool: "find_symbol", engineTool: "search_graph" }),
				expect.objectContaining({ unifiedTool: "search_code", engineTool: "search_code" }),
				expect.objectContaining({
					unifiedTool: "trace_dependency",
					engineTool: "trace_call_path",
				}),
			]),
		);
	});

	test("executes find_symbol with shaped graph lookup and snippet follow-up", async () => {
		const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
		const context: UnifiedExecutionContext = {
			unifiedTool: "find_symbol",
			routes: [
				{
					unifiedTool: "find_symbol",
					engine: "codebase-memory-mcp",
					engineTool: "search_graph",
					priority: 100,
				},
				{
					unifiedTool: "find_symbol",
					engine: "codebase-memory-mcp",
					engineTool: "get_code_snippet",
					priority: 90,
				},
			],
			input: { query: "resolveAdrDirectory" },
			projectRoot: "/tmp/project",
			config: {} as UnifiedExecutionContext["config"],
			bridgePorts: { "codebase-memory-mcp": 4701 },
			invoke: async (tool, args) => {
				calls.push({ tool, args });
				if (tool === "search_graph") {
					return {
						ok: true,
						result: {
							results: [
								{
									qualified_name: "packages.mcpAdr.resolveAdrDirectory",
								},
							],
						},
					};
				}
				return { ok: true, result: { source: "snippet" } };
			},
		};

		const result = await executeCodebaseUnifiedTool(context);
		expect(result).not.toBeNull();
		expect(calls).toEqual([
			{
				tool: "search_graph",
				args: {
					name_pattern: ".*resolveAdrDirectory.*",
					limit: 10,
				},
			},
			{
				tool: "get_code_snippet",
				args: {
					qualified_name: "packages.mcpAdr.resolveAdrDirectory",
				},
			},
		]);
	});
});
