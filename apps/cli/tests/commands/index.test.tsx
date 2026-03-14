import { describe, expect, test } from "bun:test";
import { renderInkStatic } from "../../src/testing/render-ink";
import IndexCommand from "../../src/commands/index";

const withTerminalSize = async <T,>(
	columns: number,
	rows: number,
	run: () => Promise<T>,
): Promise<T> => {
	const originalColumns = process.stdout.columns;
	const originalRows = process.stdout.rows;

	Object.defineProperty(process.stdout, "columns", {
		configurable: true,
		value: columns,
	});
	Object.defineProperty(process.stdout, "rows", {
		configurable: true,
		value: rows,
	});

	try {
		return await run();
	} finally {
		Object.defineProperty(process.stdout, "columns", {
			configurable: true,
			value: originalColumns,
		});
		Object.defineProperty(process.stdout, "rows", {
			configurable: true,
			value: originalRows,
		});
	}
};

const stripAnsi = (value: string): string => value.replace(/\u001b\[[0-9;]*m/g, "");

describe("index command", () => {
	test("renders the branded shell entry surface instead of raw JSON", async () => {
		const output = await withTerminalSize(140, 40, async () =>
			renderInkStatic(<IndexCommand options={{}} />, 140),
		);
		const sanitized = stripAnsi(output);

		expect(sanitized).toContain("MIMIRMESH");
		expect(sanitized).toContain("-- O --");
		expect(sanitized).toContain("Interactive CLI Experience");
		expect(
			sanitized.includes("Loading dashboard state") ||
				sanitized.includes(
					"Use the dashboard to launch the core setup, runtime, upgrade, and MCP workflows.",
				),
		).toBe(true);
	});

	test("renders the compact dashboard shell for smaller but usable terminals", async () => {
		const output = await withTerminalSize(90, 24, async () =>
			renderInkStatic(<IndexCommand options={{}} />, 90),
		);
		const sanitized = stripAnsi(output);

		expect(sanitized).toContain("MIMIRMESH");
		expect(sanitized).toContain("o-O-o");
		expect(sanitized).not.toContain("Compact terminal fallback");
		expect(sanitized).toContain("Loading dashboard state");
	});

	test("falls back only when the terminal is too small for the dashboard", async () => {
		const output = await withTerminalSize(68, 18, async () =>
			renderInkStatic(<IndexCommand options={{}} />, 68),
		);
		const sanitized = stripAnsi(output);

		expect(sanitized).toContain("MIMIRMESH");
		expect(sanitized).toContain("o-O-o");
		expect(sanitized).toContain("Compact terminal fallback");
		expect(sanitized).toContain("mimirmesh runtime status");
	});
});
