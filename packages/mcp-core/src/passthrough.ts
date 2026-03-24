import type { PassthroughRoute, RoutingTable } from "@mimirmesh/runtime";

import type { NormalizedToolResult, ToolName } from "./types";

export const publishedPassthroughToolName = (route: PassthroughRoute): string =>
	route.publication?.publishedTool ?? route.publicTool;

export const passthroughRouteFor = (table: RoutingTable, tool: string): PassthroughRoute | null =>
	table.passthrough.find((entry) =>
		entry.publication ? entry.publication.publishedTool === tool : entry.publicTool === tool,
	) ?? null;

export const retiredPassthroughAliasFor = (
	table: RoutingTable,
	tool: string,
): { route: PassthroughRoute; replacementName: string } | null => {
	for (const route of table.passthrough) {
		if (!route.publication) {
			continue;
		}

		if (route.publicTool === tool || route.publication.retiredAliases.includes(tool)) {
			return {
				route,
				replacementName: route.publication.publishedTool,
			};
		}
	}

	return null;
};

export const buildRetiredPassthroughAliasResult = (options: {
	requestedAlias: string;
	route: PassthroughRoute;
	replacementName: string;
}): NormalizedToolResult => {
	const message = `Passthrough alias ${options.requestedAlias} is retired. Use ${options.replacementName} instead.`;

	return {
		tool: options.requestedAlias as ToolName,
		success: false,
		message,
		items: [],
		provenance: [
			{
				engine: options.route.engine,
				tool: options.route.engineTool,
				latencyMs: 0,
				health: "degraded",
				note: `Replacement tool: ${options.replacementName}`,
			},
		],
		degraded: true,
		warnings: [`Retired passthrough aliases are no longer published: ${options.requestedAlias}.`],
		warningCodes: [],
		nextAction: `Re-run the MCP tool using \`${options.replacementName}\`.`,
		raw: {
			route: options.route,
			requestedAlias: options.requestedAlias,
			replacementName: options.replacementName,
		},
	};
};
