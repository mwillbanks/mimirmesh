import type { EngineId, EngineUpgradeDecision, MimirmeshConfig } from "@mimirmesh/config";
import { allEngineAdapters, getAdapter } from "@mimirmesh/mcp-adapters";

import { hashValue, loadBootstrapState, loadEngineState } from "../state/io";

const bootstrapInputHashForEngine = (
	projectRoot: string,
	config: MimirmeshConfig,
	engine: EngineId,
): string => {
	const adapter = getAdapter(engine);
	if (!adapter.bootstrap) {
		return hashValue({ skipped: true });
	}
	return hashValue({
		mode: adapter.bootstrap.mode,
		args: adapter.bootstrap.args(projectRoot, config),
	});
};

export const collectEngineUpgradeDecisions = async (
	projectRoot: string,
	config: MimirmeshConfig,
): Promise<EngineUpgradeDecision[]> => {
	const bootstrapState = await loadBootstrapState(projectRoot);
	const decisions: EngineUpgradeDecision[] = [];

	for (const adapter of allEngineAdapters) {
		const currentState = await loadEngineState(projectRoot, adapter.id);
		const translated = adapter.translateConfig(projectRoot, config);
		const bootstrapInputHash = bootstrapInputHashForEngine(projectRoot, config, adapter.id);
		const previousBootstrap = bootstrapState?.engines.find((entry) => entry.engine === adapter.id);
		const configHashChanged = currentState?.configHash !== hashValue(translated.contract.env);
		const bootstrapInputChanged = previousBootstrap
			? previousBootstrap.lastCompletedAt !== null &&
				previousBootstrap.bootstrapInputHash !== bootstrapInputHash
			: false;

		let runtimeAction: EngineUpgradeDecision["runtimeAction"] = "none";
		if (!currentState && config.engines[adapter.id].enabled) {
			runtimeAction = "recreate-service";
		} else if (currentState?.imageTag !== translated.contract.imageTag || configHashChanged) {
			runtimeAction = "recreate-service";
		} else if (bootstrapInputChanged) {
			runtimeAction = "rebootstrap";
		} else if (config.engines[adapter.id].enabled) {
			runtimeAction = "rediscover-only";
		}

		decisions.push({
			engine: adapter.id,
			currentImageTag: currentState?.imageTag ?? null,
			targetImageTag: translated.contract.imageTag,
			configHashChanged,
			bootstrapInputChanged,
			runtimeAction,
			assetImpact:
				runtimeAction === "rebootstrap"
					? "Preserve engine-owned indexes unless validation later quarantines them."
					: runtimeAction === "recreate-service"
						? "Refresh service definition in place while retaining compatible indexes."
						: "Keep current engine state and only refresh discovery if needed.",
		});
	}

	return decisions;
};
