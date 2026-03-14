import { describe, expect, test } from "bun:test";

import { unifiedToolInputSchemas } from "../../src";

describe("unified tool schemas", () => {
	test("publish friendly alias schemas for direct MCP registration", () => {
		expect(unifiedToolInputSchemas.find_symbol.query).toBeDefined();
		expect(unifiedToolInputSchemas.find_tests.query).toBeDefined();
		expect(unifiedToolInputSchemas.inspect_type_hierarchy.query).toBeDefined();
		expect(unifiedToolInputSchemas.inspect_platform_code.query).toBeDefined();
		expect(unifiedToolInputSchemas.list_workspace_projects).toBeDefined();
		expect(unifiedToolInputSchemas.refresh_index.path).toBeDefined();
		expect(unifiedToolInputSchemas.search_code.query).toBeDefined();
		expect(unifiedToolInputSchemas.search_docs.query).toBeDefined();
		expect(unifiedToolInputSchemas.trace_integration.query).toBeDefined();
		expect(unifiedToolInputSchemas.trace_dependency.direction).toBeDefined();
		expect(unifiedToolInputSchemas.investigate_issue.context).toBeDefined();
		expect(unifiedToolInputSchemas.generate_adr.prdPath).toBeDefined();
	});

	test("keeps explain_subsystem on the canonical friendly contract", () => {
		expect(unifiedToolInputSchemas.explain_subsystem.subsystem).toBeDefined();
		expect(unifiedToolInputSchemas.explain_subsystem.path).toBeDefined();
		expect(unifiedToolInputSchemas.explain_subsystem.query).toBeDefined();
		expect(unifiedToolInputSchemas.explain_subsystem.context).toBeDefined();
	});
});
