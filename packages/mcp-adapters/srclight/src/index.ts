import type { EngineAdapterModule } from "../../src/types";

import { srclightBootstrap } from "./bootstrap";
import { translateSrclightConfig } from "./config";
import {
	executeSrclightUnifiedTool,
	prepareSrclightToolInput,
	resolveSrclightRoutes,
	srclightRoutingRules,
} from "./routing";

export const srclightAdapter: EngineAdapterModule = {
	id: "srclight",
	namespace: "mimirmesh.srclight",
	passthroughPublication: {
		canonicalId: "srclight",
		eligibleForPublication: true,
	},
	translateConfig: translateSrclightConfig,
	bootstrap: srclightBootstrap,
	routingRules: srclightRoutingRules,
	resolveUnifiedRoutes: resolveSrclightRoutes,
	prepareToolInput: (toolName, input) => prepareSrclightToolInput(toolName, input),
	executeUnifiedTool: executeSrclightUnifiedTool,
};
