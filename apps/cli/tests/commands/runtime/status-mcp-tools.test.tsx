import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createDefaultConfig } from "@mimirmesh/config";
import { persistConnection, persistRoutingTable } from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";
import type { PresentationProfile } from "@mimirmesh/ui";

import RuntimeStatusCommand from "../../../src/commands/runtime/status";
import { renderInkUntilExit } from "../../../src/testing/render-ink";

const machinePresentation: PresentationProfile = {
	mode: "direct-machine",
	interactive: false,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "wide",
};

afterEach(() => {
	delete process.env.MIMIRMESH_PROJECT_ROOT;
	delete process.env.MIMIRMESH_SESSION_ID;
});

describe("runtime status command", () => {
	test("renders machine-readable MCP tool-surface state", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);

		try {
			process.env.MIMIRMESH_PROJECT_ROOT = repo;
			process.env.MIMIRMESH_SESSION_ID = "runtime-status-session";
			await persistConnection(repo, {
				projectName: config.runtime.projectName,
				composeFile: config.runtime.composeFile,
				updatedAt: new Date().toISOString(),
				startedAt: new Date().toISOString(),
				mounts: {
					repository: repo,
					mimirmesh: `${repo}/.mimirmesh`,
				},
				services: ["mm-srclight"],
				bridgePorts: {
					srclight: 65530,
				},
			});
			await persistRoutingTable(repo, {
				generatedAt: new Date().toISOString(),
				passthrough: [
					{
						publicTool: "mimirmesh.srclight.search_symbols",
						engine: "srclight",
						engineTool: "search_symbols",
						description: "Search symbols",
						publication: {
							canonicalEngineId: "srclight",
							publishedTool: "srclight_search_symbols",
							retiredAliases: ["mimirmesh.srclight.search_symbols"],
						},
					},
				],
				unified: [],
			});

			const output = await renderInkUntilExit(
				<RuntimeStatusCommand options={{}} presentation={machinePresentation} />,
			);

			expect(output).toContain('"toolSurface"');
			expect(output).toContain('"loadedEngineGroups"');
			expect(output).toContain('"deferredEngineGroups"');
			expect(output).toContain('"compressionLevel"');
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	}, 30_000);
});
