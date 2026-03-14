import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	clearMcpServerSession,
	detectMcpServerStaleness,
	loadLatestBuildManifest,
	persistMcpServerSession,
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
});
