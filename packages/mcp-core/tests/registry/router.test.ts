import { describe, expect, test } from "bun:test";

import { createDefaultConfig } from "@mimirmesh/config";
import { persistConnection, persistRoutingTable } from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";

import { createToolRouter } from "../../src/registry/router";

describe("mcp tool router", () => {
	test("lists unified and discovered passthrough tools", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);

		await persistConnection(repo, {
			projectName: config.runtime.projectName,
			composeFile: config.runtime.composeFile,
			updatedAt: new Date().toISOString(),
			startedAt: new Date().toISOString(),
			mounts: {
				repository: repo,
				mimirmesh: `${repo}/.mimirmesh`,
			},
			services: ["mm-codebase-memory"],
			bridgePorts: {
				srclight: 65530,
			},
		});
		await persistRoutingTable(repo, {
			generatedAt: new Date().toISOString(),
			passthrough: [
				{
					publicTool: "mimirmesh.srclight.hybrid_search",
					engine: "srclight",
					engineTool: "hybrid_search",
					description: "search code",
				},
			],
			unified: [
				{
					unifiedTool: "search_code",
					engine: "codebase-memory-mcp",
					engineTool: "search_code",
					priority: 95,
				},
				{
					unifiedTool: "search_code",
					engine: "srclight",
					engineTool: "hybrid_search",
					priority: 150,
				},
			],
		});

		const router = createToolRouter({
			projectRoot: repo,
			config,
		});

		const tools = await router.listTools();
		expect(tools.some((tool) => tool.name === "explain_project")).toBe(true);
		expect(tools.some((tool) => tool.name === "find_tests")).toBe(true);
		expect(tools.some((tool) => tool.name === "inspect_platform_code")).toBe(true);
		expect(tools.some((tool) => tool.name === "list_workspace_projects")).toBe(true);
		expect(tools.some((tool) => tool.name === "refresh_index")).toBe(true);
		expect(tools.some((tool) => tool.name === "mimirmesh.srclight.hybrid_search")).toBe(true);
	});

	test("returns provenance for passthrough failures", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);

		await persistConnection(repo, {
			projectName: config.runtime.projectName,
			composeFile: config.runtime.composeFile,
			updatedAt: new Date().toISOString(),
			startedAt: new Date().toISOString(),
			mounts: {
				repository: repo,
				mimirmesh: `${repo}/.mimirmesh`,
			},
			services: ["mm-codebase-memory"],
			bridgePorts: {
				srclight: 65530,
			},
		});
		await persistRoutingTable(repo, {
			generatedAt: new Date().toISOString(),
			passthrough: [
				{
					publicTool: "mimirmesh.srclight.hybrid_search",
					engine: "srclight",
					engineTool: "hybrid_search",
					description: "search code",
				},
			],
			unified: [],
		});

		const router = createToolRouter({
			projectRoot: repo,
			config,
		});

		const result = await router.callTool("mimirmesh.srclight.hybrid_search", { query: "export" });
		expect(result.provenance.length).toBeGreaterThan(0);
		expect(typeof result.success).toBe("boolean");
	});
});
