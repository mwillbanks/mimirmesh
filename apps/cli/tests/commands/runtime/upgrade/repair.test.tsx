import { describe, expect, test } from "bun:test";

import type { PresentationProfile } from "@mimirmesh/ui";
import RuntimeUpgradeRepairCommand from "../../../../src/commands/runtime/upgrade/repair";
import { renderInkStatic } from "../../../../src/testing/render-ink";

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

describe("runtime upgrade repair command", () => {
	test("renders a confirmation prompt with automation-safe fallback text", () => {
		const output = withInteractiveTerminal(() =>
			renderInkStatic(
				<RuntimeUpgradeRepairCommand options={{}} presentation={interactivePresentation} />,
			),
		);

		expect(output).toContain("Confirm runtime repair");
		expect(output).toContain("[DECISION REQUIRED]");
		expect(output).toContain(
			"Repairing runtime state can restore quarantined assets and rewrite upgrade metadata.",
		);
		expect(output).toContain("mimirmesh runtime upgrade repair --non-interactive");
	});
});
