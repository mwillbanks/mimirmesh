import { describe, expect, test } from "bun:test";

import { toTransportToolName } from "../../src/middleware/tool-name";

describe("server tool name middleware", () => {
	test("normalizes dotted and slash tool names", () => {
		expect(toTransportToolName("mimirmesh.codebase.search_code")).toBe(
			"mimirmesh_codebase_search_code",
		);
		expect(toTransportToolName("engine/tool")).toBe("engine_tool");
	});
});
