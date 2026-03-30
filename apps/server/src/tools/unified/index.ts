import type { ToolDefinition } from "@mimirmesh/mcp-core";

export const requiredStartupUnifiedToolNames = ["inspect_route_hints"] as const;

export const filterUnifiedTools = (tools: ToolDefinition[]): ToolDefinition[] =>
	tools.filter((tool) => tool.type === "unified");

export const missingRequiredStartupUnifiedTools = (tools: ToolDefinition[]): string[] => {
	const visible = new Set(filterUnifiedTools(tools).map((tool) => tool.name));
	return requiredStartupUnifiedToolNames.filter((name) => !visible.has(name));
};
