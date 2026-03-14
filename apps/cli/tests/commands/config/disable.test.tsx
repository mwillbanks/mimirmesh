import { describe, expect, test } from "bun:test";

import type { PresentationProfile } from "@mimirmesh/ui";
import { renderInkStatic } from "../../../src/testing/render-ink";
import ConfigDisableCommand from "../../../src/commands/config/disable";

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

describe("config disable command", () => {
	test("renders a disablement confirmation prompt with explicit consequences", () => {
		const output = withInteractiveTerminal(() =>
			renderInkStatic(
				<ConfigDisableCommand
					args={["srclight"]}
					options={{}}
					presentation={interactivePresentation}
				/>,
			),
		);

		expect(output).toContain("Confirm engine disablement");
		expect(output).toContain("[DECISION REQUIRED]");
		expect(output).toContain(
			"The srclight engine will be marked disabled in .mimirmesh/config.yml.",
		);
	});
});
