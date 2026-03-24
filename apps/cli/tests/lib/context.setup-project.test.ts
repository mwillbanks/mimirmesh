import { afterEach, describe, expect, test } from "bun:test";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type CliContext, setupProject } from "../../src/lib/context";

const exists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

describe("setupProject", () => {
	const tempRoots: string[] = [];

	afterEach(async () => {
		await Promise.all(
			tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
		);
	});

	test("creates docs/adr and does not scaffold legacy docs/decisions", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-setup-project-"));
		tempRoots.push(projectRoot);

		const directories = await setupProject({ projectRoot } as CliContext);

		expect(directories).toContain(join(projectRoot, "docs", "adr"));
		expect(directories).not.toContain(join(projectRoot, "docs", "decisions"));
		expect(await exists(join(projectRoot, "docs", "adr"))).toBe(true);
		expect(await exists(join(projectRoot, "docs", "decisions"))).toBe(false);
	});
});
