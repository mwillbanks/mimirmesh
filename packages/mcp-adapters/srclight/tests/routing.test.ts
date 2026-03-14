import { describe, expect, test } from "bun:test";

import type { UnifiedExecutionContext } from "../../src/types";

import {
	executeSrclightUnifiedTool,
	prepareSrclightToolInput,
	resolveSrclightRoutes,
} from "../src/routing";

describe("srclight routing", () => {
	test("maps discovered tools to preferred unified routes", () => {
		const routes = resolveSrclightRoutes([
			{ name: "codebase_map" },
			{ name: "search_symbols" },
			{ name: "hybrid_search" },
			{ name: "get_callers" },
			{ name: "get_tests_for" },
			{ name: "get_type_hierarchy" },
			{ name: "get_platform_variants" },
			{ name: "platform_conditionals" },
			{ name: "list_projects" },
			{ name: "reindex" },
			{ name: "changes_to" },
			{ name: "embedding_status" },
		]);

		expect(routes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ unifiedTool: "explain_project", engineTool: "codebase_map" }),
				expect.objectContaining({ unifiedTool: "find_symbol", engineTool: "search_symbols" }),
				expect.objectContaining({ unifiedTool: "find_tests", engineTool: "get_tests_for" }),
				expect.objectContaining({
					unifiedTool: "inspect_type_hierarchy",
					engineTool: "get_type_hierarchy",
				}),
				expect.objectContaining({
					unifiedTool: "inspect_platform_code",
					engineTool: "get_platform_variants",
				}),
				expect.objectContaining({
					unifiedTool: "list_workspace_projects",
					engineTool: "list_projects",
				}),
				expect.objectContaining({ unifiedTool: "refresh_index", engineTool: "reindex" }),
				expect.objectContaining({ unifiedTool: "search_code", engineTool: "hybrid_search" }),
				expect.objectContaining({ unifiedTool: "trace_dependency", engineTool: "get_callers" }),
				expect.objectContaining({ unifiedTool: "investigate_issue", engineTool: "changes_to" }),
				expect.objectContaining({
					unifiedTool: "evaluate_codebase",
					engineTool: "embedding_status",
				}),
			]),
		);
	});

	test("shapes passthrough input for symbol, search, and empty-input tools", () => {
		expect(prepareSrclightToolInput("get_symbol", { query: "ToolRouter" })).toEqual({
			name: "ToolRouter",
		});
		expect(prepareSrclightToolInput("search_symbols", { symbol: "runtimeStart" })).toEqual({
			query: "runtimeStart",
		});
		expect(
			prepareSrclightToolInput("hybrid_search", { symbol: "runtimeStart", max_results: 5 }),
		).toEqual({
			query: "runtimeStart",
			limit: 5,
		});
		expect(prepareSrclightToolInput("symbols_in_file", { filePath: "src/index.ts" })).toEqual({
			path: "src/index.ts",
		});
		expect(prepareSrclightToolInput("platform_conditionals", { query: "ignored" })).toEqual({});
		expect(prepareSrclightToolInput("reindex", { path: "src" })).toEqual({});
	});

	test("executes unified routes with Srclight-shaped input", async () => {
		const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
		const context: UnifiedExecutionContext = {
			unifiedTool: "find_symbol",
			routes: [
				{
					unifiedTool: "find_symbol",
					engine: "srclight",
					engineTool: "search_symbols",
					priority: 150,
				},
			],
			input: { query: "ToolRouter" },
			projectRoot: "/tmp/project",
			config: {} as UnifiedExecutionContext["config"],
			bridgePorts: { srclight: 4701 },
			invoke: async (tool, args) => {
				calls.push({ tool, args });
				return { ok: true, result: { tool, args } };
			},
		};

		const result = await executeSrclightUnifiedTool(context);
		expect(result).not.toBeNull();
		expect(calls).toEqual([
			{
				tool: "search_symbols",
				args: { query: "ToolRouter" },
			},
		]);
	});

	test("dispatches inspect_platform_code by presence of a symbol", async () => {
		const symbolCalls: Array<{ tool: string; args: Record<string, unknown> }> = [];
		const withSymbol: UnifiedExecutionContext = {
			unifiedTool: "inspect_platform_code",
			routes: [
				{
					unifiedTool: "inspect_platform_code",
					engine: "srclight",
					engineTool: "get_platform_variants",
					priority: 150,
				},
				{
					unifiedTool: "inspect_platform_code",
					engine: "srclight",
					engineTool: "platform_conditionals",
					priority: 149,
				},
			],
			input: { query: "Dictionary" },
			projectRoot: "/tmp/project",
			config: {} as UnifiedExecutionContext["config"],
			bridgePorts: { srclight: 4701 },
			invoke: async (tool, args) => {
				symbolCalls.push({ tool, args });
				return { ok: true, result: { tool, args } };
			},
		};

		await executeSrclightUnifiedTool(withSymbol);
		expect(symbolCalls).toEqual([
			{
				tool: "get_platform_variants",
				args: { symbol_name: "Dictionary" },
			},
		]);

		const emptyCalls: Array<{ tool: string; args: Record<string, unknown> }> = [];
		await executeSrclightUnifiedTool({
			...withSymbol,
			input: {},
			invoke: async (tool, args) => {
				emptyCalls.push({ tool, args });
				return { ok: true, result: { tool, args } };
			},
		});
		expect(emptyCalls).toEqual([
			{
				tool: "platform_conditionals",
				args: {},
			},
		]);
	});

	test("executes new single-step unified routes", async () => {
		const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
		const baseContext = {
			projectRoot: "/tmp/project",
			config: {} as UnifiedExecutionContext["config"],
			bridgePorts: { srclight: 4701 },
			invoke: async (tool: string, args: Record<string, unknown>) => {
				calls.push({ tool, args });
				return { ok: true, result: { tool, args } };
			},
		};

		await executeSrclightUnifiedTool({
			...baseContext,
			unifiedTool: "find_tests",
			routes: [
				{
					unifiedTool: "find_tests",
					engine: "srclight",
					engineTool: "get_tests_for",
					priority: 150,
				},
			],
			input: { query: "ToolRouter" },
		});
		await executeSrclightUnifiedTool({
			...baseContext,
			unifiedTool: "inspect_type_hierarchy",
			routes: [
				{
					unifiedTool: "inspect_type_hierarchy",
					engine: "srclight",
					engineTool: "get_type_hierarchy",
					priority: 150,
				},
			],
			input: { query: "ToolRouter" },
		});
		await executeSrclightUnifiedTool({
			...baseContext,
			unifiedTool: "list_workspace_projects",
			routes: [
				{
					unifiedTool: "list_workspace_projects",
					engine: "srclight",
					engineTool: "list_projects",
					priority: 150,
				},
			],
			input: {},
		});
		await executeSrclightUnifiedTool({
			...baseContext,
			unifiedTool: "refresh_index",
			routes: [
				{ unifiedTool: "refresh_index", engine: "srclight", engineTool: "reindex", priority: 150 },
			],
			input: {},
		});

		expect(calls).toEqual([
			{ tool: "get_tests_for", args: { symbol_name: "ToolRouter" } },
			{ tool: "get_type_hierarchy", args: { name: "ToolRouter" } },
			{ tool: "list_projects", args: {} },
			{ tool: "reindex", args: {} },
		]);
	});
});
