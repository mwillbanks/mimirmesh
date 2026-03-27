import { describe, expect, test } from "bun:test";

import {
	parseIntegrationCliOptions,
	shouldRunIntegrationTests,
} from "../../src/integration/manager";

describe("Integration CLI options parser", () => {
	test("disables integration when flag passed", () => {
		const options = parseIntegrationCliOptions(["--no-integration"], {});
		expect(options.shouldRunIntegration).toBe(false);
	});

	test("disables integration when environment opt-out is set", () => {
		expect(
			shouldRunIntegrationTests({
				MIMIRMESH_RUN_INTEGRATION_TESTS: "false",
			}),
		).toBe(false);
	});

	test("enables integration by default when no opt-out is present", () => {
		expect(shouldRunIntegrationTests({})).toBe(true);
	});

	test("skips prebuild when flag supplied", () => {
		const options = parseIntegrationCliOptions(["--skip-image-build"], {});
		expect(options.shouldPrebuild).toBe(false);
	});

	test("keeps warm containers when flag supplied", () => {
		const options = parseIntegrationCliOptions(["--keep-warm-containers"], {});
		expect(options.keepWarmContainers).toBe(true);
	});

	test("prunes cache only when requested", () => {
		const scan = parseIntegrationCliOptions(["--prune-docker-cache"], {});
		expect(scan.shouldPruneCache).toBe(true);
	});
});
