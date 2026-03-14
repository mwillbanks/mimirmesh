import { describe, expect, test } from "bun:test";

import { createDefaultConfig } from "@mimirmesh/config";
import { createFixtureCopy } from "@mimirmesh/testing";

import { generateAllReports } from "../../src/index";

describe("reports", () => {
	test("generates required reports", async () => {
		const repo = await createFixtureCopy("single-ts");
		const config = createDefaultConfig(repo);

		const reports = await generateAllReports(repo, config);
		const names = reports.map((report) => report.name).sort();

		expect(names).toEqual([
			"architecture.md",
			"deployment.md",
			"project-summary.md",
			"runtime-health.md",
			"speckit-status.md",
		]);
	});
});
