import { describe, expect, test } from "bun:test";

import type { PresentationProfile } from "@mimirmesh/ui";

import RuntimeTelemetryClearCommand from "../../src/commands/runtime/telemetry/clear";
import { renderInkStatic } from "../../src/testing/render-ink";

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

describe("route telemetry clear prompt safety", () => {
	test("renders an explicit confirmation prompt with reviewed scope details", () => {
		const output = withInteractiveTerminal(() =>
			renderInkStatic(
				<RuntimeTelemetryClearCommand
					options={{ scope: "route", tool: "search_code", route: "srclight:hybrid_search" }}
					presentation={interactivePresentation}
				/>,
			),
		);

		expect(output).toContain("Confirm route telemetry clear");
		expect(output).toContain("[DECISION REQUIRED]");
		expect(output).toContain(
			"This will clear telemetry for route search_code (srclight:hybrid_search).",
		);
	});
});
