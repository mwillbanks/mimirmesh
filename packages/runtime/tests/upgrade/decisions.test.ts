import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createDefaultConfig } from "@mimirmesh/config";
import { getAdapter } from "@mimirmesh/mcp-adapters";
import { createFixtureCopy } from "@mimirmesh/testing";
import { hashValue, persistBootstrapState, persistEngineState } from "../../src/state/io";
import { collectEngineUpgradeDecisions } from "../../src/upgrade/decisions";

describe("collectEngineUpgradeDecisions", () => {
	test("marks incomplete required bootstrap for rebootstrap", async () => {
		const repo = await createFixtureCopy("single-ts");
		try {
			const config = createDefaultConfig(repo);
			const translated = getAdapter("codebase-memory-mcp").translateConfig(repo, config);
			await persistEngineState(repo, {
				engine: "codebase-memory-mcp",
				enabled: true,
				required: true,
				namespace: config.engines["codebase-memory-mcp"].namespace,
				serviceName: config.engines["codebase-memory-mcp"].serviceName,
				imageTag: config.engines["codebase-memory-mcp"].image.tag,
				configHash: hashValue(translated.contract.env),
				discoveredTools: [],
				health: {
					state: "healthy",
					message: "healthy",
					checkedAt: "2026-03-14T00:00:00.000Z",
				},
				bridge: {
					url: "http://127.0.0.1:9999",
					transport: "stdio",
					healthy: true,
					checkedAt: "2026-03-14T00:00:00.000Z",
				},
				lastStartupAt: "2026-03-14T00:00:00.000Z",
				lastBootstrapAt: null,
				lastBootstrapResult: "pending",
				capabilityWarnings: [],
				runtimeEvidence: {
					bootstrapMode: "tool",
				},
			});
			await persistBootstrapState(repo, {
				updatedAt: "2026-03-14T00:00:00.000Z",
				engines: [
					{
						engine: "codebase-memory-mcp",
						required: true,
						mode: "tool",
						completed: false,
						bootstrapInputHash: "stale-hash",
						projectRootHash: "root-hash",
						lastStartedAt: "2026-03-14T00:00:00.000Z",
						lastCompletedAt: null,
						failureReason: null,
						retryCount: 0,
					},
				],
			});

			const decisions = await collectEngineUpgradeDecisions(repo, config);
			const codebaseDecision = decisions.find((entry) => entry.engine === "codebase-memory-mcp");

			expect(codebaseDecision?.runtimeAction).toBe("rebootstrap");
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});
});
