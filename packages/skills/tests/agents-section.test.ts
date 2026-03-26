import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ensureManagedAgentsSection } from "../src";

const createdRoots: string[] = [];

afterEach(async () => {
	await Promise.all(createdRoots.splice(0).map((root) => Bun.$`rm -rf ${root}`.quiet()));
});

describe("managed AGENTS.md section", () => {
	test("creates the file when missing and preserves external content on update", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-agents-section-"));
		createdRoots.push(projectRoot);

		const created = await ensureManagedAgentsSection(projectRoot);
		expect(created.outcome).toBe("created");

		await writeFile(
			join(projectRoot, "AGENTS.md"),
			`# Local notes\n\nmanual content\n\n${await readFile(join(projectRoot, "AGENTS.md"), "utf8")}`,
			"utf8",
		);
		const updated = await ensureManagedAgentsSection(projectRoot);
		expect(["updated", "no-op"]).toContain(updated.outcome);
		expect(await readFile(join(projectRoot, "AGENTS.md"), "utf8")).toContain("manual content");
	});
});
