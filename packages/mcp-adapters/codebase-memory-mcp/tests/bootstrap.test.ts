import { describe, expect, test } from "bun:test";

import { codebaseMemoryBootstrap } from "../src/bootstrap";

describe("codebase-memory bootstrap", () => {
	test("does not trigger a duplicate bootstrap index call", () => {
		expect(codebaseMemoryBootstrap).toBeNull();
	});
});
