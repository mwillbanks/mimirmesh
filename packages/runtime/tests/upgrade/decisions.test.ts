import { describe, expect, mock, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createDefaultConfig, type EngineUpgradeDecision } from "@mimirmesh/config";
import { createFixtureCopy } from "@mimirmesh/testing";
import { hashValue, persistBootstrapState, persistEngineState } from "../../src/state/io";

const loadUpgradeDecisionModules = async () => {
	mock.restore();
	const [{ getAdapter }, { collectEngineUpgradeDecisions }] = await Promise.all([
		import(`@mimirmesh/mcp-adapters?restore=${Date.now()}`),
		import(`../../src/upgrade/decisions?restore=${Date.now()}`),
	]);
	return { getAdapter, collectEngineUpgradeDecisions };
};

describe("collectEngineUpgradeDecisions", () => {
	test("marks incomplete required bootstrap for rebootstrap", async () => {
		const repo = await createFixtureCopy("single-ts");
		try {
			const { getAdapter, collectEngineUpgradeDecisions } = await loadUpgradeDecisionModules();
			const config = createDefaultConfig(repo);
			const translated = getAdapter("srclight").translateConfig(repo, config);
			await persistEngineState(repo, {
				engine: "srclight",
				enabled: true,
				required: false,
				namespace: config.engines.srclight.namespace,
				serviceName: config.engines.srclight.serviceName,
				imageTag: config.engines.srclight.image.tag,
				configHash: hashValue(translated.contract.env),
				discoveredTools: [],
				health: {
					state: "healthy",
					message: "healthy",
					checkedAt: "2026-03-14T00:00:00.000Z",
				},
				bridge: {
					url: "http://127.0.0.1:9999",
					transport: "sse",
					healthy: true,
					checkedAt: "2026-03-14T00:00:00.000Z",
				},
				lastStartupAt: "2026-03-14T00:00:00.000Z",
				lastBootstrapAt: null,
				lastBootstrapResult: "pending",
				capabilityWarnings: [],
				runtimeEvidence: {
					bootstrapMode: "command",
				},
			});
			await persistBootstrapState(repo, {
				updatedAt: "2026-03-14T00:00:00.000Z",
				engines: [
					{
						engine: "srclight",
						required: false,
						mode: "command",
						completed: false,
						bootstrapInputHash: "srclight-stale-hash",
						projectRootHash: "root-hash",
						lastStartedAt: "2026-03-14T00:00:00.000Z",
						lastCompletedAt: null,
						failureReason: null,
						retryCount: 0,
					},
				],
			});

			const decisions = await collectEngineUpgradeDecisions(repo, config);
			const srclightDecision = decisions.find(
				(entry: EngineUpgradeDecision) => entry.engine === "srclight",
			);

			expect(srclightDecision?.runtimeAction).toBe("rebootstrap");
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});
});
