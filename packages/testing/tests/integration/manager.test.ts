import { describe, expect, test } from "bun:test";

import { parseIntegrationCliOptions } from "../../src/integration/manager";

describe("Integration CLI options parser", () => {
	test("disables integration when flag passed", () => {
		const options = parseIntegrationCliOptions(["--no-integration"], {});
		expect(options.shouldRunIntegration).toBe(false);
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
