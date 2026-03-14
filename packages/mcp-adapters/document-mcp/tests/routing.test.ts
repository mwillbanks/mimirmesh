import { describe, expect, test } from "bun:test";

import { createDefaultConfig } from "@mimirmesh/config";

import {
	executeDocumentUnifiedTool,
	prepareDocumentToolInput,
	resolveDocumentRoutes,
} from "../src/routing";

describe("document-mcp unified search execution", () => {
	test("routes only explicit document tool matches for unified documentation tools", () => {
		const routes = resolveDocumentRoutes([
			{ name: "search_documents" },
			{ name: "get_document_info" },
			{ name: "reindex_document" },
			{ name: "document_feature" },
			{ name: "document_runbook" },
		]);

		expect(routes).toEqual([
			{
				unifiedTool: "search_docs",
				engine: "document-mcp",
				engineTool: "search_documents",
				priority: 100,
			},
			{
				unifiedTool: "document_architecture",
				engine: "document-mcp",
				engineTool: "search_documents",
				priority: 40,
			},
			{
				unifiedTool: "document_feature",
				engine: "document-mcp",
				engineTool: "document_feature",
				priority: 90,
			},
			{
				unifiedTool: "document_runbook",
				engine: "document-mcp",
				engineTool: "document_runbook",
				priority: 80,
			},
		]);
	});

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

	test("uses search_documents for unified document_architecture", async () => {
		const config = createDefaultConfig("/tmp/document-architecture");
		const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];

		const results = await executeDocumentUnifiedTool({
			unifiedTool: "document_architecture",
			routes: [
				{
					unifiedTool: "document_architecture",
					engine: "document-mcp",
					engineTool: "search_documents",
					priority: 40,
				},
			],
			input: {},
			projectRoot: "/tmp/document-architecture",
			config,
			bridgePorts: {},
			invoke: async (tool, args) => {
				calls.push({ tool, args });
				return {
					ok: true,
					result: {
						structuredContent: {
							result: [{ file_path: "/workspace/docs/architecture/overview.md" }],
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
					query:
						"architecture overview system design components boundaries runtime adapters routing docker compose adr",
					limit: 8,
					search_type: "chunks",
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
