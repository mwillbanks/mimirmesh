import type { EngineAdapterModule } from "../../src/types";

import { adrBootstrap } from "./bootstrap";
import { translateAdrConfig } from "./config";
import { executeAdrUnifiedTool, prepareAdrToolInput, resolveAdrRoutes } from "./routing";

export const adrAdapter: EngineAdapterModule = {
	id: "mcp-adr-analysis-server",
	namespace: "mimirmesh.adr",
	passthroughPublication: {
		canonicalId: "adr",
		eligibleForPublication: true,
	},
	translateConfig: translateAdrConfig,
	bootstrap: adrBootstrap,
	routingRules: [],
	resolveUnifiedRoutes: resolveAdrRoutes,
	prepareToolInput: (_toolName, input, context) => prepareAdrToolInput(input, context),
	executeUnifiedTool: executeAdrUnifiedTool,
};
