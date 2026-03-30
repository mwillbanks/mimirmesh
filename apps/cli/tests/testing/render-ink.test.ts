import { describe, expect, test } from "bun:test";

import { stripAnsi } from "../../src/testing/render-ink";

describe("render-ink helpers", () => {
	test("stripAnsi removes real ANSI escape sequences emitted by Ink", () => {
		const rendered = "\u001B[1mLM Studio model:\u001B[22m text-embedding-nomic-embed-text-v1.5\r\n";

		expect(stripAnsi(rendered)).toBe("LM Studio model: text-embedding-nomic-embed-text-v1.5\n");
	});
});
