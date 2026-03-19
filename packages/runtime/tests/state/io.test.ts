import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createDefaultConfig } from "@mimirmesh/config";
import { collectRetiredEngineRuntimeLeaks, createFixtureCopy } from "@mimirmesh/testing";

import { generateRuntimeFiles } from "../../src/compose/generate";
import {
	loadBootstrapState,
	loadConnection,
	loadEngineState,
	loadRoutingTable,
	persistBootstrapState,
	persistConnection,
	runtimeFiles,
} from "../../src/state/io";

describe("runtime state persistence", () => {
	test("writes required runtime metadata files", async () => {
		const repo = await createFixtureCopy("single-ts");
		try {
			const config = createDefaultConfig(repo);

			await generateRuntimeFiles(repo, config);

			const files = runtimeFiles(repo).filter((file) => !file.endsWith("/mcp-server.json"));
			for (const file of files) {
				expect(await Bun.file(file).exists()).toBe(true);
			}

			const connection = await loadConnection(repo);
			const routing = await loadRoutingTable(repo);
			const bootstrap = await loadBootstrapState(repo);
			const srclight = await loadEngineState(repo, "srclight");
			const retiredLeaks = collectRetiredEngineRuntimeLeaks({
				services: connection?.services,
				bootstrapEngines: bootstrap?.engines.map((entry) => entry.engine),
				runtimeFiles: files,
			});

			expect(connection?.composeFile.endsWith("docker-compose.yml")).toBe(true);
			expect(Array.isArray(routing?.passthrough)).toBe(true);
			expect(Array.isArray(bootstrap?.engines)).toBe(true);
			expect(retiredLeaks).toEqual([]);
			expect(bootstrap?.engines.find((entry) => entry.engine === "srclight")?.mode).toBe("command");
			expect(bootstrap?.engines.find((entry) => entry.engine === "document-mcp")?.mode).toBe(
				"none",
			);
			expect(srclight?.runtimeEvidence?.gpuMode).toBe("auto");
			expect(["cpu", "cuda"]).toContain(srclight?.runtimeEvidence?.runtimeVariant ?? "cpu");
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});

	test("preserves live bootstrap and connection state when regenerating runtime files", async () => {
		const repo = await createFixtureCopy("single-ts");
		try {
			const config = createDefaultConfig(repo);
			await persistConnection(repo, {
				projectName: config.runtime.projectName,
				composeFile: config.runtime.composeFile,
				updatedAt: "2026-03-14T00:00:00.000Z",
				startedAt: "2026-03-14T00:00:00.000Z",
				mounts: {
					repository: repo,
					mimirmesh: `${repo}/.mimirmesh`,
				},
				services: ["mm-postgres", "mm-srclight"],
				bridgePorts: {
					srclight: 4100,
				},
			});
			await persistBootstrapState(repo, {
				updatedAt: "2026-03-14T00:00:00.000Z",
				engines: [
					{
						engine: "srclight",
						required: false,
						mode: "command",
						completed: true,
						bootstrapInputHash: "srclight-hash",
						projectRootHash: "root-hash",
						lastStartedAt: "2026-03-14T00:00:00.000Z",
						lastCompletedAt: "2026-03-14T00:01:00.000Z",
						failureReason: null,
						retryCount: 0,
						command: "srclight",
						args: ["index", "/workspace"],
					},
				],
			});

			await generateRuntimeFiles(repo, config);

			const connection = await loadConnection(repo);
			const bootstrap = await loadBootstrapState(repo);
			const retiredLeaks = collectRetiredEngineRuntimeLeaks({
				services: connection?.services,
				bootstrapEngines: bootstrap?.engines.map((entry) => entry.engine),
				runtimeFiles: runtimeFiles(repo),
			});

			expect(connection?.startedAt).toBe("2026-03-14T00:00:00.000Z");
			expect(connection?.bridgePorts.srclight).toBe(4100);
			expect(retiredLeaks).toEqual([]);
			expect(bootstrap?.engines.find((entry) => entry.engine === "srclight")).toEqual(
				expect.objectContaining({
					mode: "command",
					completed: true,
					lastCompletedAt: "2026-03-14T00:01:00.000Z",
					command: "srclight",
				}),
			);
			expect(bootstrap?.engines.find((entry) => entry.engine === "document-mcp")).toEqual(
				expect.objectContaining({
					mode: "none",
					completed: true,
				}),
			);
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});
});
