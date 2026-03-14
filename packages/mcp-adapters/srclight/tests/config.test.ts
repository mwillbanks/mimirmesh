import { describe, expect, test } from "bun:test";

import { createDefaultConfig } from "@mimirmesh/config";

import { translateSrclightConfig } from "../src/config";
import type { SrclightSettings } from "../src/types";

describe("srclight config translation", () => {
	test("translates default SSE runtime config", () => {
		const config = createDefaultConfig("/tmp/srclight");
		const translated = translateSrclightConfig("/tmp/srclight", config);

		expect(translated.errors).toEqual([]);
		expect(translated.contract.id).toBe("srclight");
		expect(translated.contract.bridgeTransport).toBe("sse");
		expect(translated.contract.bridgeUrl).toBe("http://127.0.0.1:8742/sse");
		expect(translated.contract.env.SRCLIGHT_TRANSPORT).toBe("sse");
		expect(translated.contract.env.SRCLIGHT_EMBED_MODEL).toBe("nomic-embed-text");
		expect(translated.contract.env.OLLAMA_BASE_URL).toBe("http://host.docker.internal:11434");
	});

	test("uses explicit embedModel precedence over defaultEmbedModel", () => {
		const config = createDefaultConfig("/tmp/srclight");
		const settings = config.engines.srclight.settings as SrclightSettings;
		config.engines.srclight.settings = {
			...settings,
			embedModel: "custom-embed",
		};

		const translated = translateSrclightConfig("/tmp/srclight", config);
		expect(translated.degraded).toBe(false);
		expect(translated.contract.env.SRCLIGHT_EMBED_MODEL).toBe("custom-embed");
	});

	test("keeps base startup valid when embedding config is partial", () => {
		const config = createDefaultConfig("/tmp/srclight");
		const settings = config.engines.srclight.settings as SrclightSettings;
		config.engines.srclight.settings = {
			...settings,
			ollamaBaseUrl: null,
		};

		const translated = translateSrclightConfig("/tmp/srclight", config);
		expect(translated.errors).toEqual([]);
		expect(translated.degraded).toBe(true);
		expect(translated.degradedReason).toContain("semantic capabilities disabled");
		expect(translated.contract.env.SRCLIGHT_EMBED_MODEL).toBe("");
		expect(translated.contract.env.OLLAMA_BASE_URL).toBe("");
	});
});
