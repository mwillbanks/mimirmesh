import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { detectDockerAvailability } from "@mimirmesh/runtime";
import {
	loadCliContext,
	mcpCallTool,
	mcpListTools,
	runtimeAction,
} from "../../../../apps/cli/src/lib/context";

import { createFixtureCopy } from "../fixtures";

describe("integration mcp", () => {
	test("lists tools and invokes unified+passthrough", async () => {
		const docker = await detectDockerAvailability();
		if (!docker.dockerInstalled || !docker.dockerDaemonRunning || !docker.composeAvailable) {
			return;
		}

		const repo = await createFixtureCopy("single-ts", { initializeGit: true });
		const context = await loadCliContext(repo);
		try {
			await runtimeAction(context, "start");

			const tools = await mcpListTools(context);
			expect(Array.isArray(tools)).toBe(true);
			const srclightPassthrough = tools.find((tool) => tool.name.startsWith("mimirmesh.srclight."));
			const hasUnifiedSearch = tools.some((tool) => tool.name === "search_code");
			const status = await runtimeAction(context, "status");

			expect(status.health.reasons.some((reason) => reason.includes("srclight"))).toBe(false);
			expect(srclightPassthrough).toBeDefined();
			if (!srclightPassthrough) {
				throw new Error("Expected a discovered Srclight passthrough tool");
			}

			if (hasUnifiedSearch) {
				const unified = await mcpCallTool(context, "search_code", { query: "export" });
				expect(Array.isArray(unified.provenance)).toBe(true);
			}

			const passthrough = await mcpCallTool(
				context,
				srclightPassthrough.name as `mimirmesh.${string}`,
				{
					query: "export",
					symbol: "export",
				},
			);
			expect(Array.isArray(passthrough.provenance)).toBe(true);
			expect(passthrough.provenance.some((entry) => entry.engine === "srclight")).toBe(true);
		} finally {
			await runtimeAction(context, "stop");
			await rm(repo, { recursive: true, force: true });
		}
	}, 120_000);
});
