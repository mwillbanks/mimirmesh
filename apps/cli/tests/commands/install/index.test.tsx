import { describe, expect, test } from "bun:test";

import { GuidedSelect, type PresentationProfile } from "@mimirmesh/ui";
import InstallCommand from "../../../src/commands/install";
import {
	renderInkInteraction,
	renderInkStatic,
	renderInkUntilExit,
} from "../../../src/testing/render-ink";

const interactivePresentation: PresentationProfile = {
	mode: "direct-human",
	interactive: true,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "wide",
};

const nonInteractivePresentation: PresentationProfile = {
	mode: "direct-human",
	interactive: false,
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

describe("install command", () => {
	test("renders the guided preset selector when no explicit choices are provided interactively", () => {
		const output = withInteractiveTerminal(() =>
			renderInkStatic(<InstallCommand options={{}} presentation={interactivePresentation} />),
		);

		expect(output).toContain("Install MímirMesh");
		expect(output).toContain("Choose an installation preset");
		expect(output).toContain("[DECISION REQUIRED]");
		expect(output).toContain("mimirmesh install --non-interactive --preset recommended");
	});

	test("fails safely in non-interactive mode without explicit install choices", async () => {
		const output = await renderInkUntilExit(
			<InstallCommand
				options={{ nonInteractive: true }}
				presentation={nonInteractivePresentation}
			/>,
		);

		expect(output).toContain("Install MímirMesh");
		expect(output).toContain("Install requires a preset or explicit install-area selections.");
		expect(output).toContain("Terminal outcome");
	});

	test("renders install-specific help for non-interactive flag discovery", () => {
		const output = renderInkStatic(
			<InstallCommand options={{ help: true }} presentation={interactivePresentation} />,
		);

		expect(output).toContain("Usage: mimirmesh install [flags]");
		expect(output).toContain("--preset <minimal|recommended|full>");
		expect(output).toContain("--areas <core,ide,skills>");
		expect(output).toContain("--ide <target[,target]>");
		expect(output).toContain("--skills <all|name[,name]>");
		expect(output).toContain(
			"--embeddings <disabled|docker-llama-cpp|existing-lm-studio|existing-openai-compatible|openai>",
		);
		expect(output).toContain("--embeddings-model <value>");
		expect(output).toContain("--embeddings-base-url <value>");
		expect(output).toContain("--embeddings-api-key <value>");
		expect(output).toContain("--yes");
		expect(output).toContain("--non-interactive");
		expect(output).toContain("--json");
	});

	test("fails safely when an unsupported embeddings strategy is requested", async () => {
		const output = await renderInkUntilExit(
			<InstallCommand
				options={{ nonInteractive: true, preset: "recommended", embeddings: "broken-mode" }}
				presentation={nonInteractivePresentation}
			/>,
		);

		expect(output).toContain("Unknown embeddings strategy: broken-mode.");
		expect(output).toContain("Terminal outcome");
	});

	test("shows the multi-target IDE selector when interactive install includes IDE integration", () => {
		const output = withInteractiveTerminal(() =>
			renderInkStatic(
				<InstallCommand
					options={{ areas: "core,ide", preset: "full" }}
					presentation={interactivePresentation}
				/>,
			),
		);

		expect(output).toContain("Choose IDE integrations");
		expect(output).toContain("Select IDEs or agents");
		expect(output).toContain("VS Code");
		expect(output).toContain("Cursor");
		expect(output).toContain("press space to toggle items, and press enter to continue");
	});

	test("guided select marks with space and submits the highlighted choice with enter", async () => {
		let submittedValue: string | null = null;

		const output = await renderInkInteraction(
			<GuidedSelect
				title="Choose an installation preset"
				reason="Pick a preset."
				consequence="The preset defines the starting areas."
				nonInteractiveFallback="mimirmesh install --non-interactive --preset recommended"
				choices={[
					{
						label: "Recommended",
						value: "recommended",
						description: "Install the core repository setup plus bundled repository skills.",
						recommended: true,
					},
					{
						label: "Full",
						value: "full",
						description: "Install core setup, bundled skills, and IDE integrations.",
					},
				]}
				defaultValue="recommended"
				onSubmit={(value) => {
					submittedValue = value;
				}}
			/>,
			async ({ stdin, wait }) => {
				stdin.write(" ");
				await wait();
				stdin.write("\u001B[B");
				await wait();
				stdin.write("\r");
				await wait();
			},
		);

		expect(output).toContain("Install core setup, bundled skills, and IDE integrations.");
		expect(output).toContain(
			"press space to mark a choice, and press enter to continue with the highlighted option",
		);
		expect(submittedValue as string | null).toBe("full");
	});
});
