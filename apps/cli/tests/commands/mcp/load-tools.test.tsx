import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { createServer } from "node:net";

import { createDefaultConfig } from "@mimirmesh/config";
import { persistConnection, persistRoutingTable } from "@mimirmesh/runtime";
import { createFixtureCopy } from "@mimirmesh/testing";
import type { PresentationProfile } from "@mimirmesh/ui";

import McpLoadToolsCommand from "../../../src/commands/mcp/load-tools";
import { renderInkUntilExit } from "../../../src/testing/render-ink";

const machinePresentation: PresentationProfile = {
	mode: "direct-machine",
	interactive: false,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "wide",
};

let bridgeServer: ReturnType<typeof Bun.serve> | null = null;

const reservePort = async (): Promise<number> =>
	new Promise((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			const port = typeof address === "object" && address ? address.port : null;
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				if (!port) {
					reject(new Error("Failed to reserve test port"));
					return;
				}
				resolve(port);
			});
		});
	});

afterEach(async () => {
	delete process.env.MIMIRMESH_PROJECT_ROOT;
	delete process.env.MIMIRMESH_SESSION_ID;
	if (bridgeServer) {
		await bridgeServer.stop(true);
		bridgeServer = null;
	}
});

describe("mcp load-tools command", () => {
	test("renders machine-readable loaded-engine state after deferred discovery", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);
		const port = await reservePort();
		bridgeServer = Bun.serve({
			port,
			fetch(request) {
				const url = new URL(request.url);
				if (url.pathname === "/discover") {
					return Response.json({
						ok: true,
						tools: [
							{
								name: "hybrid_search",
								description: "Search code",
								inputSchema: {
									type: "object",
									properties: {
										query: { type: "string" },
									},
								},
							},
						],
					});
				}
				if (url.pathname === "/health") {
					return Response.json({
						ok: true,
						ready: true,
						child: {
							running: true,
						},
					});
				}
				return new Response("not found", { status: 404 });
			},
		});

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
					srclight: port,
				},
			});
			await persistRoutingTable(repo, {
				generatedAt: new Date().toISOString(),
				passthrough: [],
				unified: [],
			});

			const output = await renderInkUntilExit(
				<McpLoadToolsCommand args={["srclight"]} options={{}} presentation={machinePresentation} />,
			);

			expect(output).toContain('"loadedEngineGroups"');
			expect(output).toContain('"srclight"');
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	}, 30_000);
});
