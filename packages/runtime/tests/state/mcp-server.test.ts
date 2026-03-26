import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	clearMcpServerSession,
	createDefaultMcpToolSurfaceSession,
	detectMcpServerStaleness,
	loadLatestBuildManifest,
	loadMcpToolSurfaceSession,
	persistMcpServerSession,
	persistMcpToolSurfaceSession,
} from "../../src";

describe("mcp server runtime state", () => {
	test("detects a stale MCP server session against the latest local build manifest", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-mcp-server-"));
		try {
			await mkdir(join(projectRoot, "dist"), { recursive: true });
			await writeFile(
				join(projectRoot, "dist", "manifest.json"),
				`${JSON.stringify(
					{
						version: "1.2.3",
						builtAt: "2026-03-17T12:00:00.000Z",
						buildId: "1.2.3+2026-03-17T12:00:00.000Z",
						artifacts: ["mimirmesh-server"],
					},
					null,
					2,
				)}\n`,
				"utf8",
			);

			await persistMcpServerSession(projectRoot, {
				pid: process.pid,
				sessionId: "test-session",
				startedAt: "2026-03-17T11:00:00.000Z",
				version: "1.2.2",
				builtAt: "2026-03-17T11:00:00.000Z",
				buildId: "1.2.2+2026-03-17T11:00:00.000Z",
				executablePath: process.execPath,
				manifestPath: null,
			});

			const latest = await loadLatestBuildManifest(projectRoot, process.execPath);
			const status = await detectMcpServerStaleness(projectRoot, process.execPath);

			expect(latest?.manifest.buildId).toBe("1.2.3+2026-03-17T12:00:00.000Z");
			expect(status.state).toBe("stale");
			if (status.state === "stale") {
				expect(status.latest.buildId).toBe("1.2.3+2026-03-17T12:00:00.000Z");
				expect(status.session.buildId).toBe("1.2.2+2026-03-17T11:00:00.000Z");
			}
		} finally {
			await clearMcpServerSession(projectRoot);
			await rm(projectRoot, { recursive: true, force: true });
		}
	});

	test("persists session-scoped tool-surface state for deferred engine groups", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-mcp-session-"));
		try {
			const session = createDefaultMcpToolSurfaceSession({
				sessionId: "cli-default",
				policyVersion: "policy-v1",
				compressionLevel: "balanced",
			});
			session.loadedEngineGroups = ["srclight"];
			session.lastNotificationAt = "2026-03-17T12:05:00.000Z";
			session.lazyLoadDiagnostics = [
				{
					sessionId: "cli-default",
					engineId: "srclight",
					trigger: "explicit-load",
					startedAt: "2026-03-17T12:00:00.000Z",
					completedAt: "2026-03-17T12:00:01.000Z",
					outcome: "success",
					discoveredToolCount: 4,
					diagnostics: ["Loaded 4 tool(s)."],
					notificationSent: true,
				},
			];

			await persistMcpToolSurfaceSession(projectRoot, session);
			const loaded = await loadMcpToolSurfaceSession(projectRoot, "cli-default");

			expect(loaded?.loadedEngineGroups).toEqual(["srclight"]);
			expect(loaded?.lazyLoadDiagnostics[0]?.notificationSent).toBe(true);
		} finally {
			await rm(projectRoot, { recursive: true, force: true });
		}
	});
});
