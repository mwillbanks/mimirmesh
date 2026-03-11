import type { MimirmeshConfig } from "@mimirmesh/config";
import type { EngineDiscoveredTool, UnifiedRoute } from "@mimirmesh/runtime";

import { resolveRoutesFromPatterns } from "../../src/utils";
import type { AdapterRoutingRule } from "../../src/types";
import { resolveAdrDirectory } from "./config";
import type { AdrSettings } from "./types";

export const adrRoutingRules: AdapterRoutingRule[] = [
  {
    unifiedTool: "generate_adr",
    candidateToolPatterns: [/adr/i, /architect/i, /decision/i],
    priority: 100,
  },
  {
    unifiedTool: "trace_integration",
    candidateToolPatterns: [/integration/i, /deployment/i, /ecosystem/i],
    priority: 80,
  },
  {
    unifiedTool: "evaluate_codebase",
    candidateToolPatterns: [/analy/i, /ecosystem/i, /health/i],
    priority: 70,
  },
];

export const resolveAdrRoutes = (tools: EngineDiscoveredTool[]): UnifiedRoute[] =>
  resolveRoutesFromPatterns("mcp-adr-analysis-server", tools, adrRoutingRules);

const schemaHasProperty = (inputSchema: Record<string, unknown> | undefined, property: string): boolean => {
  const properties = inputSchema?.properties;
  return typeof properties === "object" && properties !== null && property in properties;
};

export const prepareAdrToolInput = (
  input: Record<string, unknown>,
  options: {
    projectRoot: string;
    config: MimirmeshConfig;
    inputSchema?: Record<string, unknown>;
  },
): Record<string, unknown> => {
  const prepared = { ...input };
  const settings = options.config.engines["mcp-adr-analysis-server"].settings as AdrSettings;

  if (schemaHasProperty(options.inputSchema, "adrDirectory") && prepared.adrDirectory == null) {
    prepared.adrDirectory = resolveAdrDirectory(options.projectRoot, settings);
  }

  if (schemaHasProperty(options.inputSchema, "projectPath") && prepared.projectPath == null) {
    prepared.projectPath = settings.projectPath;
  }

  return prepared;
};
