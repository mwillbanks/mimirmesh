import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export type FixtureType = "single-ts" | "bun-monorepo" | "docs-heavy" | "docker-iac";

export const fixturesRoot = join(process.cwd(), "packages", "testing", "fixtures");

export const createTempDirectory = async (prefix = "mimirmesh-"): Promise<string> =>
	mkdtemp(join(tmpdir(), prefix));

const write = async (path: string, content: string): Promise<void> => {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, content, "utf8");
};

export const createFixtureRepository = async (
	rootPath: string,
	type: FixtureType,
): Promise<string> => {
	if (type === "single-ts") {
		await write(
			join(rootPath, "package.json"),
			JSON.stringify(
				{
					name: "fixture-single-ts",
					version: "1.0.0",
					private: true,
					dependencies: {
						express: "^4.19.2",
					},
				},
				null,
				2,
			),
		);
		await write(join(rootPath, "src/index.ts"), "export const hello = 'world';\n");
		await write(join(rootPath, "README.md"), "# Fixture Single TS\n");
	}

	if (type === "bun-monorepo") {
		await write(
			join(rootPath, "package.json"),
			JSON.stringify(
				{
					name: "fixture-bun-monorepo",
					private: true,
					workspaces: ["apps/*", "packages/*"],
				},
				null,
				2,
			),
		);
		await write(join(rootPath, "bun.lock"), "");
		await write(join(rootPath, "apps/api/src/main.ts"), "console.log('api');\n");
		await write(join(rootPath, "packages/shared/src/index.ts"), "export const shared = 1;\n");
	}

	if (type === "docs-heavy") {
		await write(join(rootPath, "README.md"), "# Docs Heavy Fixture\n");
		await write(join(rootPath, "docs/architecture/overview.md"), "Architecture details\n");
		await write(join(rootPath, "docs/runbooks/oncall.md"), "Oncall runbook\n");
		await write(join(rootPath, "docs/features/feature-a.md"), "Feature A\n");
		await write(join(rootPath, "docs/specifications/spec-001.md"), "Spec 001\n");
	}

	if (type === "docker-iac") {
		await write(join(rootPath, "Dockerfile"), "FROM oven/bun:1\n");
		await write(
			join(rootPath, "docker-compose.yml"),
			"services:\n  app:\n    image: example/app\n",
		);
		await write(join(rootPath, ".github/workflows/ci.yml"), "name: CI\n");
		await write(join(rootPath, "infra/main.tf"), "terraform {}\n");
		await write(join(rootPath, "infra/Pulumi.yaml"), "name: fixture\n");
	}

	return rootPath;
};

export const materializeFixture = async (type: FixtureType): Promise<string> => {
	const root = await createTempDirectory(`mimirmesh-fixture-${type}-`);
	await createFixtureRepository(root, type);
	return root;
};

const runGit = async (rootPath: string, args: string[]): Promise<void> => {
	const child = Bun.spawn({
		cmd: ["git", ...args],
		cwd: rootPath,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);

	if (code !== 0) {
		throw new Error(stderr.trim() || stdout.trim() || `git ${args.join(" ")} failed`);
	}
};

export const initializeGitRepository = async (rootPath: string): Promise<void> => {
	await runGit(rootPath, ["init", "-q"]);
	await runGit(rootPath, ["config", "user.name", "Mimirmesh Test"]);
	await runGit(rootPath, ["config", "user.email", "tests@mimirmesh.local"]);
	await runGit(rootPath, ["add", "-A"]);
	await runGit(rootPath, ["commit", "-qm", "Initial fixture commit"]);
};

export const createFixtureCopy = async (
	fixtureName: FixtureType,
	options?: { initializeGit?: boolean },
): Promise<string> => {
	const destination = await mkdtemp(join(tmpdir(), `mimirmesh-${fixtureName}-`));
	await cp(join(fixturesRoot, fixtureName), destination, { recursive: true });
	if (options?.initializeGit) {
		await initializeGitRepository(destination);
	}
	return destination;
};
