import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createFixtureCopy } from "@mimirmesh/testing";
import type { PresentationProfile } from "@mimirmesh/ui";

import McpToolSchemaCommand from "../../../src/commands/mcp/tool-schema";
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

describe("mcp tool-schema command", () => {
	test("renders full schema payload for unified tools", async () => {
		const repo = await createFixtureCopy("single-ts");
		try {
			process.env.MIMIRMESH_PROJECT_ROOT = repo;
			process.env.MIMIRMESH_SESSION_ID = "command-session";

			const output = await renderInkUntilExit(
				<McpToolSchemaCommand
					args={["explain_project"]}
					options={{ view: "full" }}
					presentation={machinePresentation}
				/>,
			);

			expect(output).toContain('"toolName": "explain_project"');
			expect(output).toContain('"inputSchema"');
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	}, 30_000);
});
