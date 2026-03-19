import { afterEach, describe, expect, test } from "bun:test";
import { access, rm } from "node:fs/promises";
import { join } from "node:path";
import { runtimeStop } from "@mimirmesh/runtime";
import { createFixtureCopy, createSpecifyStub } from "@mimirmesh/testing";
import { initializeProject, loadCliContext } from "apps/cli/src/lib/context";

const exists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

describe("integration init flow", () => {
	afterEach(() => {
		delete process.env.MIMIRMESH_SPECIFY_BIN;
	});

	test("initializes fixture repo to runtime+report state", async () => {
		const repo = await createFixtureCopy("single-ts");
		try {
			process.env.MIMIRMESH_SPECIFY_BIN = await createSpecifyStub(
				join(repo, ".mimirmesh", "testing"),
			);
			const context = await loadCliContext(repo);
			const result = await initializeProject(context);

			expect(result.analysis.fileCount).toBeGreaterThan(0);
			expect(["bootstrapping", "ready", "degraded", "failed"]).toContain(result.runtimeState);
			expect(await exists(join(repo, ".mimirmesh", "config.yml"))).toBe(true);
			expect(await exists(join(repo, ".mimirmesh", "runtime", "docker-compose.yml"))).toBe(true);
			expect(await exists(join(repo, ".mimirmesh", "runtime", "routing-table.json"))).toBe(true);
			expect(await exists(join(repo, ".mimirmesh", "runtime", "bootstrap-state.json"))).toBe(true);
			expect(await exists(join(repo, ".mimirmesh", "reports", "project-summary.md"))).toBe(true);
			expect(await exists(join(repo, ".specify", "scripts", "bash", "common.sh"))).toBe(true);
			expect(await exists(join(repo, "docs", "specifications"))).toBe(true);
			expect(result.specKit.ready).toBe(true);
		} finally {
			const context = await loadCliContext(repo);
			await runtimeStop(repo, context.config, context.logger);
			await rm(repo, { recursive: true, force: true });
		}
	}, 360_000);
});
