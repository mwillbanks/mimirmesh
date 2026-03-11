import { describe, expect, test } from "bun:test";

import { createDefaultConfig } from "@mimirmesh/config";

import { renderCompose } from "./render";

describe("runtime compose render", () => {
	test("renders real engine services and postgres", () => {
		const projectRoot = "/tmp/mimirmesh-render";
		const config = createDefaultConfig(projectRoot);
		const rendered = renderCompose(projectRoot, config);

		expect(rendered.includes("mm-postgres")).toBe(true);
		expect(rendered.includes("mm-srclight")).toBe(true);
		expect(rendered.includes("mm-document-mcp")).toBe(true);
		expect(rendered.includes("mm-adr-analysis")).toBe(true);
		expect(rendered.includes("mm-codebase-memory")).toBe(true);
		expect(rendered.includes("dockerfile")).toBe(true);
		expect(rendered.includes("MIMIRMESH_ENGINE_TRANSPORT: 'sse'")).toBe(true);
		expect(rendered.includes("MIMIRMESH_ENGINE_URL: 'http://127.0.0.1:8742/sse'")).toBe(true);
	});
});
