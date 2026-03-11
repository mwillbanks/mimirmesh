import type { EngineAdapterModule } from "../../src/types";

import { documentMcpBootstrap } from "./bootstrap";
import { translateDocumentMcpConfig } from "./config";
import {
  executeDocumentUnifiedTool,
  prepareDocumentToolInput,
  resolveDocumentRoutes,
} from "./routing";

export const documentMcpAdapter: EngineAdapterModule = {
  id: "document-mcp",
  namespace: "mimirmesh.docs",
  translateConfig: translateDocumentMcpConfig,
  bootstrap: documentMcpBootstrap,
  routingRules: [],
  resolveUnifiedRoutes: resolveDocumentRoutes,
  prepareToolInput: (toolName, input) => prepareDocumentToolInput(toolName, input),
  executeUnifiedTool: executeDocumentUnifiedTool,
};

export { translateDocumentMcpConfig };
