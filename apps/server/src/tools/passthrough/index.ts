import type { ToolDefinition } from "@mimirmesh/mcp-core";

export const filterPassthroughTools = (tools: ToolDefinition[]): ToolDefinition[] =>
  tools.filter((tool) => tool.type === "passthrough");
