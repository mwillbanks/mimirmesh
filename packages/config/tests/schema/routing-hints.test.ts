import { describe, expect, test } from "bun:test";

import { createDefaultConfig } from "../../src/defaults";
import { validateConfigValue } from "../../src/schema";

describe("route hint config schema", () => {
	test("defaults adaptive subset include and exclude arrays", () => {
		const config = createDefaultConfig("/tmp/project");
		const result = validateConfigValue(config);

		expect(result.ok).toBe(true);
		expect(result.config?.mcp.routingHints.adaptiveSubset).toEqual({
			include: [],
			exclude: [],
		});
	});

	test("backfills missing routing hints from legacy config shapes", () => {
		const config = createDefaultConfig("/tmp/project");
		const legacyShape = {
			...config,
			mcp: {
				toolSurface: config.mcp.toolSurface,
			},
		};

		const result = validateConfigValue(legacyShape);
		expect(result.ok).toBe(true);
		expect(result.config?.mcp.routingHints.adaptiveSubset).toEqual({
			include: [],
			exclude: [],
		});
	});

	test("rejects duplicate adaptive subset entries", () => {
		const config = createDefaultConfig("/tmp/project");
		config.mcp.routingHints.adaptiveSubset.include = ["find_symbol", "find_symbol"];

		const result = validateConfigValue(config);
		expect(result.ok).toBe(false);
		expect(
			result.errors.some((error) =>
				error.includes("Adaptive subset include entries must be unique."),
			),
		).toBe(true);
	});
});
