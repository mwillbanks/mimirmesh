import type { RoutingTable } from "@mimirmesh/runtime";
import type { RoutingEngineRoute, UnifiedToolName } from "../types";

export const unifiedRoutesFor = (table: RoutingTable, tool: string): RoutingEngineRoute[] => {
	return table.unified
		.filter((route) => route.unifiedTool === tool)
		.map((route) => ({
			unifiedTool: route.unifiedTool as UnifiedToolName,
			engine: route.engine,
			engineTool: route.engineTool,
			priority: route.priority,
		}))
		.sort((a, b) => b.priority - a.priority);
};

export const passthroughRouteFor = (table: RoutingTable, tool: string) =>
	table.passthrough.find((entry) => entry.publicTool === tool) ?? null;
