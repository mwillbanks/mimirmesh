import type { MimirmeshConfig } from "@mimirmesh/config";

import type { EngineConfigTranslationResult } from "../../src/types";
import type { CodebaseMemorySettings } from "./types";

export const translateCodebaseMemoryConfig = (
	_projectRoot: string,
	config: MimirmeshConfig,
	_context?: import("../../src/types").RuntimeAdapterContext,
): EngineConfigTranslationResult => {
	const engine = config.engines["codebase-memory-mcp"];
	const settings = engine.settings as CodebaseMemorySettings;
	const errors: string[] = [];

	if (!settings.repoPath.trim()) {
		errors.push("codebase-memory-mcp.settings.repoPath is required");
	}
	if (!settings.cachePath.trim()) {
		errors.push("codebase-memory-mcp.settings.cachePath is required");
	}

	return {
		contract: {
			id: "codebase-memory-mcp",
			namespace: engine.namespace,
			serviceName: engine.serviceName,
			required: engine.required,
			dockerfile: engine.image.dockerfile,
			context: engine.image.context,
			imageTag: engine.image.tag,
			bridgePort: engine.bridge.containerPort,
			bridgeTransport: "stdio",
			mounts: {
				repo: engine.mounts.repo,
				mimirmesh: engine.mounts.mimirmesh,
			},
			env: {
				REPO_PATH: settings.repoPath,
				CODEBASE_MEMORY_CACHE_PATH: settings.cachePath,
				FORCE_REINDEX: settings.forceReindex ? "true" : "false",
			},
		},
		errors,
		degraded: errors.length > 0,
		degradedReason: errors.length > 0 ? errors.join("; ") : undefined,
	};
};
