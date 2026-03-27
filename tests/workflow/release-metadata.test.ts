import { describe, expect, test } from "bun:test";

import {
	findReleaseTarget,
	getChannelArchiveName,
	getExecutableArtifactNames,
	getVersionedArchiveName,
	RELEASE_TARGETS,
} from "../../scripts/lib/release-metadata";

describe("release target metadata", () => {
	test("covers the supported platform and architecture matrix", () => {
		expect(RELEASE_TARGETS).toHaveLength(6);
		expect(RELEASE_TARGETS.map((target) => target.id)).toEqual([
			"darwin-x64",
			"darwin-arm64",
			"linux-x64",
			"linux-arm64",
			"windows-x64",
			"windows-arm64",
		]);
	});

	test("uses executable and archive formats that match each platform family", () => {
		const windows = findReleaseTarget("windows", "x64");
		const linux = findReleaseTarget("linux", "arm64");

		expect(windows).toBeDefined();
		expect(linux).toBeDefined();
		if (!windows || !linux) {
			throw new Error("Expected release targets were not defined");
		}

		expect(windows.archiveFormat).toBe("zip");
		expect(getExecutableArtifactNames(windows)).toContain("mimirmesh.exe");

		expect(linux.archiveFormat).toBe("tar.gz");
		expect(getExecutableArtifactNames(linux)).toContain("mimirmesh");
	});

	test("generates stable release asset names", () => {
		const target = findReleaseTarget("darwin", "arm64");
		expect(target).toBeDefined();
		if (!target) {
			throw new Error("Expected darwin-arm64 target to exist");
		}
		expect(getVersionedArchiveName("1.2.3", target)).toBe("mimirmesh-1.2.3-darwin-arm64.tar.gz");
		expect(getChannelArchiveName(target)).toBe("mimirmesh-darwin-arm64.tar.gz");
	});
});
