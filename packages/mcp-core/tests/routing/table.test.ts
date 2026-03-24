import { describe, expect, test } from "bun:test";

import type { RoutingTable } from "@mimirmesh/runtime";

import { publishedPassthroughToolName, retiredPassthroughAliasFor } from "../../src/passthrough";
import { passthroughRouteFor, unifiedRoutesFor } from "../../src/routing/table";

const table: RoutingTable = {
	generatedAt: new Date().toISOString(),
	passthrough: [
		{
			publicTool: "mimirmesh.srclight.hybrid_search",
			engine: "srclight",
			engineTool: "hybrid_search",
			publication: {
				canonicalEngineId: "srclight",
				publishedTool: "srclight_hybrid_search",
				retiredAliases: ["mimirmesh.srclight.hybrid_search"],
			},
		},
	],
	unified: [
		{
			unifiedTool: "search_code",
			engine: "document-mcp",
			engineTool: "search_documents",
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
		const route = passthroughRouteFor(table, "srclight_hybrid_search");
		expect(route?.engineTool).toBe("hybrid_search");
	});

	test("returns the published passthrough name from publication metadata", () => {
		const route = table.passthrough[0];
		expect(route).toBeDefined();
		if (!route) {
			throw new Error("expected a passthrough route");
		}
		expect(publishedPassthroughToolName(route)).toBe("srclight_hybrid_search");
	});

	test("matches retired passthrough aliases separately from published names", () => {
		const retired = retiredPassthroughAliasFor(table, "mimirmesh.srclight.hybrid_search");
		expect(retired?.replacementName).toBe("srclight_hybrid_search");
	});
});
