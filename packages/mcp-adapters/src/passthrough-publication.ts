const normalizePassthroughToolSegment = (tool: string): string =>
	tool
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "_")
		.replace(/^_+|_+$/g, "") || "tool";

export const buildLegacyPassthroughToolName = (namespace: string, tool: string): string =>
	`${namespace}.${normalizePassthroughToolSegment(tool)}`;

export const buildPublishedPassthroughToolName = (canonicalId: string, tool: string): string =>
	`${canonicalId}_${normalizePassthroughToolSegment(tool)}`;

export const buildTransportToolName = (toolName: string): string =>
	toolName.replaceAll(".", "_").replaceAll("/", "_");
