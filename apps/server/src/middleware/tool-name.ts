export const toTransportToolName = (toolName: string): string =>
	toolName.replaceAll(".", "_").replaceAll("/", "_");
