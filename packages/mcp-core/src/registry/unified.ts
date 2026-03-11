import type { UnifiedToolName } from "../types";

export const unifiedToolDescriptions: Record<UnifiedToolName, string> = {
  explain_project: "Summarize repository architecture, key boundaries, and operating model.",
  explain_subsystem: "Explain the design and responsibilities of a project subsystem.",
  find_symbol: "Find symbols and declarations across source files.",
  search_code: "Search code content with ranked relevance.",
  search_docs: "Search documentation and operational guidance.",
  trace_dependency: "Trace package/module dependency relationships.",
  trace_integration: "Trace integrations, CI/CD, and external system touch points.",
  investigate_issue: "Investigate a reported issue using multi-engine evidence.",
  evaluate_codebase: "Evaluate maintainability, risks, and architecture quality.",
  generate_adr: "Generate ADR-oriented decision analysis.",
  document_feature: "Generate feature documentation from project context.",
  document_architecture: "Generate architecture documentation from project context.",
  document_runbook: "Generate operational runbooks from project context.",
  runtime_status: "Return runtime health and engine availability.",
  config_get: "Read project-local MímirMesh config values.",
  config_set: "Set project-local MímirMesh config values.",
};

export const unifiedToolList = Object.entries(unifiedToolDescriptions).map(([name, description]) => ({
  name: name as UnifiedToolName,
  description,
}));

export const isUnifiedTool = (name: string): name is UnifiedToolName =>
  Object.hasOwn(unifiedToolDescriptions, name);
