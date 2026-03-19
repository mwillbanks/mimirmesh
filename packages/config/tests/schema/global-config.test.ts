import { describe, expect, test } from "bun:test";

import { createDefaultGlobalConfig } from "../../src/defaults";
import { validateGlobalConfigValue } from "../../src/schema";

describe("global config schema", () => {
	test("creates and validates default global config", () => {
		const config = createDefaultGlobalConfig();
		const result = validateGlobalConfigValue(config);

		expect(result.ok).toBe(true);
		expect(result.config?.skills.install.symbolic).toBe(true);
	});

	test("accepts skills.install.symbolic overrides", () => {
		const result = validateGlobalConfigValue({
			version: 1,
			skills: {
				install: {
					symbolic: false,
				},
			},
		});

		expect(result.ok).toBe(true);
		expect(result.config?.skills.install.symbolic).toBe(false);
	});
});
