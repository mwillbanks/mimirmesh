import type { EngineDiscoveredTool, UnifiedRoute } from "@mimirmesh/runtime";

import { resolveRoutesFromPatterns } from "../../src/utils";
import type { AdapterRoutingRule } from "../../src/types";

export const codebaseRoutingRules: AdapterRoutingRule[] = [
  { unifiedTool: "explain_project", candidateToolPatterns: [/get_architecture/i], priority: 100 },
  { unifiedTool: "explain_subsystem", candidateToolPatterns: [/get_architecture/i, /search_graph/i], priority: 90 },
  { unifiedTool: "find_symbol", candidateToolPatterns: [/search_graph/i, /get_code_snippet/i], priority: 100 },
  { unifiedTool: "search_code", candidateToolPatterns: [/search_code/i], priority: 95 },
  { unifiedTool: "trace_dependency", candidateToolPatterns: [/trace_call_path/i, /query_graph/i], priority: 95 },
  { unifiedTool: "trace_integration", candidateToolPatterns: [/query_graph/i, /search_graph/i], priority: 80 },
  { unifiedTool: "investigate_issue", candidateToolPatterns: [/detect_changes/i, /trace_call_path/i, /search_code/i], priority: 95 },
  { unifiedTool: "evaluate_codebase", candidateToolPatterns: [/get_architecture/i, /get_graph_schema/i], priority: 85 },
  { unifiedTool: "generate_adr", candidateToolPatterns: [/manage_adr/i], priority: 60 },
];

export const resolveCodebaseRoutes = (tools: EngineDiscoveredTool[]): UnifiedRoute[] =>
  resolveRoutesFromPatterns("codebase-memory-mcp", tools, codebaseRoutingRules);
