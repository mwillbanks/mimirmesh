import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createDefaultConfig } from "@mimirmesh/config";
import { createFixtureCopy } from "@mimirmesh/testing";
import { hashValue, persistBootstrapState, persistEngineState } from "../../src/state/io";
import { collectEngineUpgradeDecisions } from "../../src/upgrade/decisions";

describe("collectEngineUpgradeDecisions", () => {
	test("marks incomplete required bootstrap for rebootstrap", async () => {
		const repo = await createFixtureCopy("single-ts");
		try {
			const config = createDefaultConfig(repo);
			const settings = config.engines.srclight.settings as {
				transport: "stdio" | "sse";
				port: number;
				rootPath: string;
				indexOnStart: boolean;
				defaultEmbedModel: string;
				embedModel: string | null;
				ollamaBaseUrl: string | null;
				embedRequestTimeoutSeconds: number;
			};
			const translatedEnv = {
				SRCLIGHT_TRANSPORT: settings.transport,
				SRCLIGHT_PORT: String(settings.port),
				SRCLIGHT_ROOT_PATH: settings.rootPath,
				SRCLIGHT_INDEX_ON_START: settings.indexOnStart ? "true" : "false",
				SRCLIGHT_EMBED_MODEL: settings.embedModel ?? settings.defaultEmbedModel,
				OLLAMA_BASE_URL: settings.ollamaBaseUrl ?? "",
				SRCLIGHT_EMBED_REQUEST_TIMEOUT: String(settings.embedRequestTimeoutSeconds),
				SRCLIGHT_GPU_MODE: config.runtime.gpuMode,
				SRCLIGHT_GPU_ENABLED: "",
			};
			await persistEngineState(repo, {
				engine: "srclight",
				enabled: true,
				required: false,
				namespace: config.engines.srclight.namespace,
				serviceName: config.engines.srclight.serviceName,
				imageTag: config.engines.srclight.image.tag,
				configHash: hashValue(translatedEnv),
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
			const srclightDecision = decisions.find((entry) => entry.engine === "srclight");

			expect(srclightDecision?.runtimeAction).toBe("rebootstrap");
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});
});
