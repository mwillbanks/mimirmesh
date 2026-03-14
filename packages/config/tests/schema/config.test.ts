import { describe, expect, test } from "bun:test";

import { createDefaultConfig } from "../../src/defaults";
import { disableEngine, enableEngine, getConfigValue, setConfigValue } from "../../src/mutations";
import { validateConfigValue } from "../../src/schema/index";

describe("config schema", () => {
	test("creates and validates default config", () => {
		const config = createDefaultConfig("/tmp/project");
		const result = validateConfigValue(config);
		expect(result.ok).toBe(true);
		expect(result.config?.runtime.routingTableFile.endsWith("routing-table.json")).toBe(true);
		expect(result.config?.runtime.gpuMode).toBe("auto");
		expect(result.config?.engines.srclight.settings).toMatchObject({ transport: "sse" });
		expect(result.config?.engines.srclight.settings).toMatchObject({
			defaultEmbedModel: "nomic-embed-text",
			ollamaBaseUrl: "http://host.docker.internal:11434",
		});
		expect(result.config?.engines["mcp-adr-analysis-server"].settings).toMatchObject({
			adrDirectory: "docs/adr",
		});
	});

	test("supports get/set and engine toggles", () => {
		const config = createDefaultConfig("/tmp/project");
		const updated = setConfigValue(config, "logging.level", "debug");
		expect(getConfigValue(updated, "logging.level")).toBe("debug");

		const disabled = disableEngine(updated, "srclight");
		expect(disabled.engines.srclight.enabled).toBe(false);

		const enabled = enableEngine(disabled, "srclight");
		expect(enabled.engines.srclight.enabled).toBe(true);
	});

	test("defaults legacy-missing gpuMode to auto without reading legacy srclight gpu flags", () => {
		const config = createDefaultConfig("/tmp/project");
		const legacyShape = {
			...config,
			runtime: Object.fromEntries(
				Object.entries(config.runtime).filter(([key]) => key !== "gpuMode"),
			),
			engines: {
				...config.engines,
				srclight: {
					...config.engines.srclight,
					settings: {
						...config.engines.srclight.settings,
						gpuEnabled: true,
					},
				},
			},
		};

		const result = validateConfigValue(legacyShape);
		expect(result.ok).toBe(true);
		expect(result.config?.runtime.gpuMode).toBe("auto");
	});
});
