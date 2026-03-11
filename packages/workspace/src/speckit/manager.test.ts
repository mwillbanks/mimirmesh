import { afterEach, describe, expect, test } from "bun:test";
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { detectSpecKit, initializeSpecKit } from "./manager";

const createTempRepo = async (): Promise<string> => mkdtemp(join(tmpdir(), "mimirmesh-speckit-"));

const createSpecifyStub = async (rootPath: string): Promise<string> => {
	const scriptPath = join(rootPath, "specify-stub.sh");
	await mkdir(dirname(scriptPath), { recursive: true });
	await writeFile(
		scriptPath,
		`#!/usr/bin/env bash
set -e

if [[ "$1" == "--version" ]]; then
  echo "specify-cli 0.2.1"
  exit 0
fi

if [[ "$1" == "init" ]]; then
  mkdir -p .specify/memory .specify/scripts/bash .specify/templates .codex/prompts
  cat > .specify/memory/constitution.md <<'DOC'
# Constitution
DOC
  cat > .specify/scripts/bash/common.sh <<'DOC'
get_feature_dir() { echo "$1/specs/$2"; }
DOC
  cat > .codex/prompts/speckit.plan.md <<'DOC'
Use /specs/[###-feature-name]/plan.md
DOC
  exit 0
fi

echo "unsupported args: $*" >&2
exit 1
`,
		"utf8",
	);
	await chmod(scriptPath, 0o755);
	return scriptPath;
};

const pathExists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

describe("speckit manager", () => {
	afterEach(() => {
		delete process.env.MIMIRMESH_SPECIFY_BIN;
	});

	test("does not treat orphaned agent prompts as initialized Spec Kit", async () => {
		const repo = await createTempRepo();
		try {
			await mkdir(join(repo, ".github", "prompts"), { recursive: true });
			await writeFile(
				join(repo, ".github", "prompts", "speckit.plan.prompt.md"),
				"Use /specs/[###-feature-name]/plan.md\n",
				"utf8",
			);
			await mkdir(join(repo, "docs", "specifications"), { recursive: true });

			const status = await detectSpecKit(repo);
			expect(status.initialized).toBe(false);
			expect(status.ready).toBe(false);
			expect(status.agent).toBeNull();
			expect(status.promptDirectories).toContain(".github/prompts");
			expect(status.findings).toContain(
				"Spec Kit agent prompts exist, but `.specify/` is missing. Run `mimirmesh speckit init` to complete initialization.",
			);
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});

	test("initializes upstream Spec Kit and translates legacy specs paths", async () => {
		const repo = await createTempRepo();
		try {
			process.env.MIMIRMESH_SPECIFY_BIN = await createSpecifyStub(
				join(repo, ".mimirmesh", "testing"),
			);

			const result = await initializeSpecKit(repo);
			expect(result.initialized).toBe(true);
			expect(result.status.ready).toBe(true);
			expect(result.status.version).toBe("0.2.1");
			expect(await pathExists(join(repo, ".specify", "scripts", "bash", "common.sh"))).toBe(true);
			expect(await pathExists(join(repo, "docs", "specifications"))).toBe(true);

			const commonScript = await readFile(
				join(repo, ".specify", "scripts", "bash", "common.sh"),
				"utf8",
			);
			expect(commonScript.includes("docs/specifications")).toBe(true);
			expect(commonScript.includes("/specs/")).toBe(false);
		} finally {
			await rm(repo, { recursive: true, force: true });
		}
	});
});
