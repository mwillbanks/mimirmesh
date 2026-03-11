import { describe, expect, test } from "bun:test";

import type { UnifiedExecutionContext } from "../../src/types";

import {
  executeSrclightUnifiedTool,
  prepareSrclightToolInput,
  resolveSrclightRoutes,
} from "./routing";

describe("srclight routing", () => {
  test("maps discovered tools to preferred unified routes", () => {
    const routes = resolveSrclightRoutes([
      { name: "codebase_map" },
      { name: "search_symbols" },
      { name: "hybrid_search" },
      { name: "get_callers" },
    ]);

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ unifiedTool: "explain_project", engineTool: "codebase_map" }),
        expect.objectContaining({ unifiedTool: "find_symbol", engineTool: "search_symbols" }),
        expect.objectContaining({ unifiedTool: "search_code", engineTool: "hybrid_search" }),
        expect.objectContaining({ unifiedTool: "trace_dependency", engineTool: "get_callers" }),
      ]),
    );
  });

  test("shapes passthrough input for symbol and search tools", () => {
    expect(prepareSrclightToolInput("get_symbol", { query: "ToolRouter" })).toEqual({
      symbol: "ToolRouter",
    });
    expect(prepareSrclightToolInput("hybrid_search", { symbol: "runtimeStart", max_results: 5 })).toEqual({
      query: "runtimeStart",
      limit: 5,
    });
    expect(prepareSrclightToolInput("symbols_in_file", { filePath: "src/index.ts" })).toEqual({
      file_path: "src/index.ts",
    });
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
        args: { symbol: "ToolRouter" },
      },
    ]);
  });
});