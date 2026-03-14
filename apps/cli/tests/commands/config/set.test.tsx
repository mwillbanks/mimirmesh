import { describe, expect, test } from "bun:test";

import type { PresentationProfile } from "@mimirmesh/ui";
import { renderInkStatic } from "../../../src/testing/render-ink";
import ConfigSetCommand from "../../../src/commands/config/set";

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

describe("config set command", () => {
	test("renders a configuration mutation confirmation prompt with automation fallback", () => {
		const output = withInteractiveTerminal(() =>
			renderInkStatic(
				<ConfigSetCommand
					args={["logging.level", "debug"]}
					options={{}}
					presentation={interactivePresentation}
				/>,
			),
		);

		expect(output).toContain("Confirm configuration update");
		expect(output).toContain("This will set logging.level to debug in .mimirmesh/config.yml.");
		expect(output).toContain("mimirmesh config set <path> <value> --non-interactive");
	});
});
