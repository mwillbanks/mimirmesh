import { describe, expect, test } from "bun:test";

import { sanitizeErrorMessage, toSafeJsonValue } from "./engine-bridge.mjs";

describe("engine bridge response hardening", () => {
	test("sanitizes error messages to a single line", () => {
		const error = new Error("boom\n    at doWork (/tmp/example.ts:1:1)\nfollow-up");
		expect(sanitizeErrorMessage(error)).toBe("boom follow-up");
	});

	test("serializes errors without stack or cause details", () => {
		const cause = new Error("inner failure");
		const error = new Error("outer failure", { cause });
		error.stack = "Error: outer failure\n    at run (/tmp/example.ts:1:1)";

		expect(toSafeJsonValue({ error })).toEqual({
			error: {
				name: "Error",
				message: "outer failure",
			},
		});
	});

	test("removes nested stack fields from plain objects", () => {
		expect(
			toSafeJsonValue({
				ok: false,
				error: {
					message: "failed",
					stack: "secret stack",
					cause: {
						detail: "safe context",
						stack: "nested secret stack",
					},
				},
			}),
		).toEqual({
			ok: false,
			error: {
				message: "failed",
				cause: {
					detail: "safe context",
				},
			},
		});
	});
});
