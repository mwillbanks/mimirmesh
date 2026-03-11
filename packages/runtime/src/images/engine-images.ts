import type { EngineId } from "@mimirmesh/config";

import type { EngineRuntimeContract } from "@mimirmesh/mcp-adapters";

export type EngineCommand = {
	command: string;
	args: string[];
	transport: "stdio" | "sse" | "streamable-http";
	url?: string;
};

export const engineCommand = (
	engine: EngineId,
	contract?: Partial<Pick<EngineRuntimeContract, "bridgeTransport" | "bridgeUrl" | "env">>,
): EngineCommand => {
	const env = contract?.env ?? {};

	switch (engine) {
		case "srclight":
			return {
				command: "srclight",
				args: [
					"serve",
					"--transport",
					env.SRCLIGHT_TRANSPORT ?? "sse",
					"--port",
					env.SRCLIGHT_PORT ?? "8742",
				],
				transport: contract?.bridgeTransport ?? "sse",
				url: contract?.bridgeUrl,
			};
		case "document-mcp":
			return {
				command: "uv",
				args: ["run", "--directory", "/opt/document-mcp", "python", "-m", "src.main"],
				transport: "stdio",
			};
		case "mcp-adr-analysis-server":
			return {
				command: "mcp-adr-analysis-server",
				args: [],
				transport: "stdio",
			};
		case "codebase-memory-mcp":
			return {
				command: "/usr/local/bin/codebase-memory-mcp",
				args: [],
				transport: "stdio",
			};
		default: {
			const exhaustive: never = engine;
			throw new Error(`Unsupported engine: ${String(exhaustive)}`);
		}
	}
};
