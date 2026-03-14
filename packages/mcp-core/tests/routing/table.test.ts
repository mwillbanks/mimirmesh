import { describe, expect, test } from "bun:test";

import type { RoutingTable } from "@mimirmesh/runtime";

import { passthroughRouteFor, unifiedRoutesFor } from "../../src/routing/table";

const table: RoutingTable = {
	generatedAt: new Date().toISOString(),
	passthrough: [
		{
			publicTool: "mimirmesh.srclight.hybrid_search",
			engine: "srclight",
			engineTool: "hybrid_search",
		},
	],
	unified: [
		{
			unifiedTool: "search_code",
			engine: "codebase-memory-mcp",
			engineTool: "search_code",
			priority: 90,
		},
		{
			unifiedTool: "search_code",
			engine: "srclight",
			engineTool: "search_code",
			priority: 100,
		},
	],
};

describe("mcp routing table", () => {
	test("returns unified routes sorted by priority", () => {
		const routes = unifiedRoutesFor(table, "search_code");
		expect(routes.length).toBe(2);
		expect(routes[0]?.engine).toBe("srclight");
	});

	test("returns passthrough route by public tool", () => {
		const route = passthroughRouteFor(table, "mimirmesh.srclight.hybrid_search");
		expect(route?.engineTool).toBe("hybrid_search");
	});
});
