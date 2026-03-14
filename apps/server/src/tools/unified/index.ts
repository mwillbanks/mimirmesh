import type { ToolDefinition } from "@mimirmesh/mcp-core";

export const filterUnifiedTools = (tools: ToolDefinition[]): ToolDefinition[] =>
	tools.filter((tool) => tool.type === "unified");
