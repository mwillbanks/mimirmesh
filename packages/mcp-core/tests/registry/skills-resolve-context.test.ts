import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultConfig } from "@mimirmesh/config";

import { createToolRouter } from "../../src/registry/router";

const createdRoots: string[] = [];

afterEach(async () => {
	await Promise.all(createdRoots.splice(0).map((root) => Bun.$`rm -rf ${root}`.quiet()));
});

describe("skills resolve MCP engine context", () => {
	test("accepts structured MCP engine context without outranking explicit prompt matches", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mimirmesh-mcp-skill-context-"));
		createdRoots.push(projectRoot);
		const skillRoot = join(projectRoot, ".agents", "skills", "context-aware-skill");
		await mkdir(skillRoot, { recursive: true });
		await writeFile(
			join(skillRoot, "SKILL.md"),
			`---
name: context-aware-skill
description: Context aware skill
---

# context-aware-skill
`,
			"utf8",
		);

		const router = createToolRouter({
			projectRoot,
			config: createDefaultConfig(projectRoot),
		});

		const result = await router.callTool("skills.resolve", {
			prompt: "use context-aware-skill",
			mcpEngineContext: {
				engine: "srclight",
				hints: ["context-aware-skill"],
			},
			include: ["matchReason"],
		});

		expect(result.success).toBe(true);
		expect(result.raw).toMatchObject({
			usedMcpEngineContext: true,
		});
	});
});
