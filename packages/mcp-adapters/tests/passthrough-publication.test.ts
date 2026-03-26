import { describe, expect, test } from "bun:test";

import {
	buildLegacyPassthroughToolName,
	buildPublishedPassthroughToolName,
	buildTransportToolName,
} from "../src/passthrough-publication";

describe("passthrough publication", () => {
	test("normalizes tool names without regex backtracking behavior changes", () => {
		expect(buildLegacyPassthroughToolName("mimirmesh.docs", "  Search---Docs  ")).toBe(
			"mimirmesh.docs.search---docs",
		);
		expect(buildPublishedPassthroughToolName("docs", "___---___")).toBe("docs_---");
		expect(buildPublishedPassthroughToolName("adr", "%%%Validate   ADR%%%")).toBe(
			"adr_validate_adr",
		);
		expect(buildPublishedPassthroughToolName("docs", "__Search_Docs__")).toBe("docs_search_docs");
	});

	test("keeps transport-safe replacements unchanged", () => {
		expect(buildTransportToolName("docs.search/doc")).toBe("docs_search_doc");
	});
});
