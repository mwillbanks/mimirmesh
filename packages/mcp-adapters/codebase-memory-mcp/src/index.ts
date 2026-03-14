import type { EngineAdapterModule } from "../../src/types";

import { codebaseMemoryBootstrap } from "./bootstrap";
import { translateCodebaseMemoryConfig } from "./config";
import { executeCodebaseUnifiedTool, resolveCodebaseRoutes } from "./routing";

export const codebaseMemoryAdapter: EngineAdapterModule = {
	id: "codebase-memory-mcp",
	namespace: "mimirmesh.codebase",
	translateConfig: translateCodebaseMemoryConfig,
	bootstrap: codebaseMemoryBootstrap,
	routingRules: [],
	resolveUnifiedRoutes: resolveCodebaseRoutes,
	executeUnifiedTool: executeCodebaseUnifiedTool,
};
