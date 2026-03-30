import type { RouteHintSnapshot, RoutingTable } from "@mimirmesh/runtime";
import { passthroughRouteFor as resolvePassthroughRoute } from "../passthrough";
import type { RoutingEngineRoute, UnifiedToolName } from "../types";
import { compareHintedRoutes } from "./hints";

const routeSnapshotKey = (route: Pick<RoutingEngineRoute, "engine" | "engineTool">): string =>
	`${route.engine}:${route.engineTool}`;

const hasAdaptiveOrdering = (
	routes: RoutingEngineRoute[],
	snapshotsByKey: Map<string, RouteHintSnapshot>,
): boolean =>
	routes.length > 1 &&
	routes.every((route) => {
		const snapshot = snapshotsByKey.get(routeSnapshotKey(route));
		return Boolean(snapshot?.subsetEligible);
	}) &&
	routes.some((route) => {
		const snapshot = snapshotsByKey.get(routeSnapshotKey(route));
		return snapshot?.sourceMode === "mixed" || snapshot?.sourceMode === "adaptive";
	}) &&
	!routes.some((route) => {
		const snapshot = snapshotsByKey.get(routeSnapshotKey(route));
		return snapshot?.sourceMode === "stale" || snapshot?.sourceMode === "insufficient-data";
	});

export const unifiedRoutesFor = (
	table: RoutingTable,
	tool: string,
	options: {
		hintSnapshots?: RouteHintSnapshot[];
	} = {},
): RoutingEngineRoute[] => {
	const routes = table.unified
		.filter((route) => route.unifiedTool === tool)
		.map((route) => ({
			unifiedTool: route.unifiedTool as UnifiedToolName,
			engine: route.engine,
			engineTool: route.engineTool,
			priority: route.priority,
			executionStrategy: route.executionStrategy,
			seedHint: route.seedHint,
			inputSchema: route.inputSchema,
		}))
		.sort((a, b) => b.priority - a.priority);

	const snapshotsByKey = new Map(
		(options.hintSnapshots ?? []).map((snapshot) => [
			`${snapshot.engine}:${snapshot.engineTool}`,
			snapshot,
		]),
	);
	if (!hasAdaptiveOrdering(routes, snapshotsByKey)) {
		return routes;
	}

	return [...routes].sort((left, right) =>
		compareHintedRoutes(
			snapshotsByKey.get(routeSnapshotKey(left)) as RouteHintSnapshot,
			snapshotsByKey.get(routeSnapshotKey(right)) as RouteHintSnapshot,
		),
	);
};

export const passthroughRouteFor = (table: RoutingTable, tool: string) =>
	resolvePassthroughRoute(table, tool);
