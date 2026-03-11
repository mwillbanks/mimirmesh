import { describe, expect, test } from "bun:test";

import { createDefaultConfig } from "@mimirmesh/config";

import { executeDocumentUnifiedTool, prepareDocumentToolInput } from "./routing";

describe("document-mcp unified search execution", () => {
  test("prefers the upstream search_documents tool for unified search_docs", async () => {
    const config = createDefaultConfig("/tmp/document-unified");
    const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];

    const results = await executeDocumentUnifiedTool({
      unifiedTool: "search_docs",
      routes: [
        {
          unifiedTool: "search_docs",
          engine: "document-mcp",
          engineTool: "search_documents",
          priority: 100,
        },
      ],
      input: {
        query: "first-init",
        limit: 5,
        search_type: "documents",
      },
      projectRoot: "/tmp/document-unified",
      config,
      bridgePorts: {},
      invoke: async (tool, args) => {
        calls.push({ tool, args });
        return {
          ok: true,
          result: {
            structuredContent: {
              result: [{ file_path: "/workspace/docs/runbooks/first-init.md" }],
            },
          },
        };
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      tool: "search_documents",
      args: {
        input: {
          query: "first-init",
          limit: 5,
          search_type: "documents",
        },
      },
    });
    expect(results).toHaveLength(1);
    expect(results?.[0]?.route.engineTool).toBe("search_documents");
  });

  test("wraps upstream document tool calls that require an input envelope", () => {
    expect(prepareDocumentToolInput("search_documents", { query: "mimirmesh" })).toEqual({
      input: { query: "mimirmesh" },
    });
    expect(
      prepareDocumentToolInput("search_documents", {
        input: { query: "mimirmesh" },
      }),
    ).toEqual({
      input: { query: "mimirmesh" },
    });
    expect(prepareDocumentToolInput("get_indexing_stats", {})).toEqual({});
  });
});
