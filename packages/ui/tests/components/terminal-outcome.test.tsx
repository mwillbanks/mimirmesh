import { describe, expect, test } from "bun:test";
import { renderToString } from "ink";

import { TerminalOutcome } from "../../src/components/terminal-outcome";

const ESC = String.fromCharCode(0x1b);
const ansiPattern = new RegExp(`${ESC}(?:[@-Z\\-_]|\\[[0-?]*[ -/]*[@-~])`, "g");

const stripAnsi = (value: string): string => value.replace(ansiPattern, "").replaceAll("\r", "");

describe("TerminalOutcome", () => {
	test("renders explicit status labels, impact, evidence, and next action text", () => {
		const output = stripAnsi(
			renderToString(
				<TerminalOutcome
					outcome={{
						kind: "degraded",
						message: "Runtime is degraded.",
						impact: "MCP passthrough and runtime-backed workflows are limited.",
						completedWork: ["Loaded project-local runtime state"],
						blockedCapabilities: ["Live MCP passthrough discovery"],
						nextAction: "Repair the runtime or rerun the lifecycle action after Docker is ready.",
						evidence: [{ label: "Runtime state", value: "degraded" }],
					}}
				/>,
				{ columns: 120 },
			),
		);

		expect(output).toContain("Terminal outcome");
		expect(output).toContain("[DEGRADED] Runtime is degraded.");
		expect(output).toContain("Impact: MCP passthrough and runtime-backed workflows are limited.");
		expect(output).toContain("Completed work");
		expect(output).toContain("Blocked capability");
		expect(output).toContain("Runtime state: degraded");
		expect(output).toContain(
			"Next action: Repair the runtime or rerun the lifecycle action after Docker is ready.",
		);
	});
});
