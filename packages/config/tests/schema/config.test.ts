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
		expect(Object.keys(result.config?.engines ?? {})).not.toContain("codebase-memory-mcp");
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

	test("rejects prototype-polluting path segments and does not mutate Object.prototype", () => {
		const config = createDefaultConfig("/tmp/project");

		expect(() => setConfigValue(config, "__proto__.polluted", true)).toThrow(
			"Config path segment '__proto__' is not allowed.",
		);
		expect(() => setConfigValue(config, "logging.constructor.level", "debug")).toThrow(
			"Config path segment 'constructor' is not allowed.",
		);
		expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
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

	test("rejects tool-surface policies that place an engine in both core and deferred groups", () => {
		const config = createDefaultConfig("/tmp/project");
		config.mcp.toolSurface.coreEngineGroups = ["srclight"];
		config.mcp.toolSurface.deferredEngineGroups = ["srclight"];

		const result = validateConfigValue(config);
		expect(result.ok).toBe(false);
		expect(result.errors.some((error) => error.includes("cannot be both core and deferred"))).toBe(
			true,
		);
	});
});
