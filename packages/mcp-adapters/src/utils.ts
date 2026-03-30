import type { EngineId } from "@mimirmesh/config";

import type { EngineDiscoveredTool, UnifiedRoute } from "@mimirmesh/runtime";

import type { AdapterRoutingRule } from "./types";

const buildSeedHint = (engine: EngineId, match: EngineDiscoveredTool, rule: AdapterRoutingRule) => {
	const seedHint = rule.seedHintsByTool?.[match.name] ?? rule.seedHintDefaults;
	if (!seedHint || !rule.executionStrategy) {
		return null;
	}

	return {
		unifiedTool: rule.unifiedTool,
		engine,
		engineTool: match.name,
		executionStrategy: rule.executionStrategy,
		...seedHint,
	};
};

export const resolveRoutesFromPatterns = (
	engine: EngineId,
	tools: EngineDiscoveredTool[],
	rules: AdapterRoutingRule[],
): UnifiedRoute[] => {
	const routes: UnifiedRoute[] = [];
	for (const rule of rules) {
		const matches = tools.filter((tool) =>
			rule.candidateToolPatterns.some((pattern) => pattern.test(tool.name)),
		);
		for (const match of matches) {
			routes.push({
				unifiedTool: rule.unifiedTool,
				engine,
				engineTool: match.name,
				priority: rule.priority,
				executionStrategy: rule.executionStrategy,
				seedHint: buildSeedHint(engine, match, rule),
				inputSchema: match.inputSchema,
			});
		}
	}
	return routes;
};
