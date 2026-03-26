import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createDefaultConfig } from "@mimirmesh/config";
import { persistConnection, persistRoutingTable } from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";
import type { PresentationProfile } from "@mimirmesh/ui";

import McpListToolsCommand from "../../../src/commands/mcp/list-tools";
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

describe("mcp list-tools command", () => {
	test("renders machine-readable deferred-group metadata", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);
		try {
			process.env.MIMIRMESH_PROJECT_ROOT = repo;
			process.env.MIMIRMESH_SESSION_ID = "command-session";
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
						publicTool: "mimirmesh.srclight.hybrid_search",
						engine: "srclight",
						engineTool: "hybrid_search",
						description: "Search code",
						publication: {
							canonicalEngineId: "srclight",
							publishedTool: "srclight_hybrid_search",
							retiredAliases: ["mimirmesh.srclight.hybrid_search"],
						},
					},
				],
				unified: [],
			});

			const output = await renderInkUntilExit(
				<McpListToolsCommand options={{}} presentation={machinePresentation} />,
			);

			expect(output).toContain('"sessionId": "command-session"');
			expect(output).toContain('"deferredEngineGroups"');
			expect(output).toContain('"compressionLevel"');
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	}, 30_000);
});
