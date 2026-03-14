import { describe, expect, test } from "bun:test";
import type { PresentationProfile, WorkflowDefinition } from "@mimirmesh/ui";
import { Box, Text } from "ink";
import { useState } from "react";
import { renderInkFrame, renderInkUntilExit } from "../../src/testing/render-ink";
import { CommandRunner } from "../../src/lib/command-runner";

const ESC = String.fromCharCode(0x1b);
const ansiPattern = new RegExp(`${ESC}(?:[@-Z\\-_]|\\[[0-?]*[ -/]*[@-~])`, "g");

const stripAnsi = (value: string): string => value.replace(ansiPattern, "").replaceAll("\r", "");

const humanPresentation: PresentationProfile = {
	mode: "direct-human",
	interactive: false,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "wide",
};

const machinePresentation: PresentationProfile = {
	...humanPresentation,
	mode: "direct-machine",
};

const definition: WorkflowDefinition = {
	id: "command-runner-test",
	title: "Command Runner Test",
	description: "Render workflow progress and terminal outcomes for direct commands.",
	category: "runtime",
	entryModes: ["direct-command"],
	interactivePolicy: "default-non-interactive",
	machineReadableSupported: true,
	requiresProjectContext: false,
	recommendedNextActions: [],
	steps: [{ id: "inspect", label: "Inspect runtime", kind: "discovery" }],
	execute: async ({ controller }) => {
		controller.startStep("inspect", "Checking runtime state.");
		controller.completeStep("inspect", {
			summary: "Runtime is ready.",
			evidence: [{ label: "Runtime state", value: "ready" }],
		});

		return {
			kind: "success",
			message: "Runtime is ready.",
			impact: "Live runtime workflows can use the project-local services.",
			completedWork: ["Inspect runtime"],
			blockedCapabilities: [],
			nextAction: "Continue to the next workflow.",
			machineReadablePayload: { runtime: "ready" },
		};
	},
};

describe("CommandRunner", () => {
	test("renders human-readable step progress and terminal outcome summaries", async () => {
		const output = stripAnsi(
			await renderInkUntilExit(
				<CommandRunner definition={definition} presentation={humanPresentation} />,
			),
		);

		expect(output).toContain("Command Runner Test");
		expect(output).toContain("Workflow progress");
		expect(output).toContain("[x] Inspect runtime (completed)");
		expect(output).toContain("Runtime state: ready");
		expect(output).toContain("Terminal outcome");
		expect(output).toContain("[SUCCESS] Runtime is ready.");
		expect(output).toContain("Next action: Continue to the next workflow.");
	});

	test("renders machine-readable output with workflow and outcome parity", async () => {
		const output = stripAnsi(
			await renderInkUntilExit(
				<CommandRunner definition={definition} presentation={machinePresentation} />,
			),
		);

		expect(output).toContain('"workflowId": "command-runner-test"');
		expect(output).toContain('"phase": "success"');
		expect(output).toContain('"kind": "success"');
		expect(output).toContain('"runtime": "ready"');
	});

	test("only calls onComplete once when parent state changes after terminal completion", async () => {
		let completions = 0;

		const Wrapper = () => {
			const [refreshTick, setRefreshTick] = useState(0);

			return (
				<Box flexDirection="column">
					<Text>Refresh tick: {refreshTick}</Text>
					<CommandRunner
						definition={definition}
						presentation={humanPresentation}
						exitOnComplete={false}
						onComplete={() => {
							completions += 1;
							if (refreshTick === 0) {
								setRefreshTick(1);
							}
						}}
					/>
				</Box>
			);
		};

		await renderInkFrame(<Wrapper />, { waitMs: 150 });
		expect(completions).toBe(1);
	});

	test("does not restart a completed workflow when parent rerenders with a fresh definition object", async () => {
		let executions = 0;

		const Wrapper = () => {
			const [refreshTick, setRefreshTick] = useState(0);
			const rerenderedDefinition: WorkflowDefinition = {
				...definition,
				description: `Render cycle ${refreshTick}`,
				execute: async ({ controller }) => {
					executions += 1;
					controller.startStep("inspect", "Checking runtime state.");
					controller.completeStep("inspect", {
						summary: "Runtime is ready.",
						evidence: [{ label: "Runtime state", value: "ready" }],
					});

					return {
						kind: "success",
						message: "Runtime is ready.",
						impact: "Live runtime workflows can use the project-local services.",
						completedWork: ["Inspect runtime"],
						blockedCapabilities: [],
						nextAction: "Continue to the next workflow.",
						machineReadablePayload: { runtime: "ready" },
					};
				},
			};

			return (
				<CommandRunner
					definition={rerenderedDefinition}
					presentation={humanPresentation}
					exitOnComplete={false}
					onComplete={() => {
						if (refreshTick === 0) {
							setRefreshTick(1);
						}
					}}
				/>
			);
		};

		await renderInkFrame(<Wrapper />, { waitMs: 250 });
		expect(executions).toBe(1);
	});
});
