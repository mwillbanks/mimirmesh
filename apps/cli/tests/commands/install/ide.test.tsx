import { describe, expect, test } from "bun:test";

import type { PresentationProfile } from "@mimirmesh/ui";
import { renderInkStatic } from "../../../src/testing/render-ink";
import InstallIdeCommand from "../../../src/commands/install/ide";

const interactivePresentation: PresentationProfile = {
	mode: "direct-human",
	interactive: true,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "wide",
};

const withInteractiveTerminal = <T,>(run: () => T): T => {
	const originalStdoutTty = process.stdout.isTTY;
	const originalStdinTty = process.stdin.isTTY;

	Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
	Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });

	try {
		return run();
	} finally {
		Object.defineProperty(process.stdout, "isTTY", {
			configurable: true,
			value: originalStdoutTty,
		});
		Object.defineProperty(process.stdin, "isTTY", {
			configurable: true,
			value: originalStdinTty,
		});
	}
};

describe("install ide command", () => {
	test("renders the guided IDE target selector when no target is provided interactively", () => {
		const output = withInteractiveTerminal(() =>
			renderInkStatic(<InstallIdeCommand options={{}} presentation={interactivePresentation} />),
		);

		expect(output).toContain("Install IDE MCP Integration");
		expect(output).toContain("Choose an IDE or agent");
		expect(output).toContain("[DECISION REQUIRED]");
		expect(output).toContain(
			"mimirmesh install ide --non-interactive --target vscode|cursor|claude|codex",
		);
	});
});
