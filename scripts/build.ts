import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { writeBundledSkillAssets } from "../packages/skills/src/index";

const projectRoot = process.cwd();
const distDir = join(projectRoot, "dist");

const run = async (cmd: string[]): Promise<void> => {
	const process = Bun.spawn({ cmd, cwd: projectRoot, stdout: "inherit", stderr: "inherit" });
	const exitCode = await process.exited;
	if (exitCode !== 0) {
		throw new Error(`Command failed (${exitCode}): ${cmd.join(" ")}`);
	}
};

const resolveRepository = async (): Promise<string | null> => {
	const fromEnv = process.env.MIMIRMESH_GITHUB_REPOSITORY ?? process.env.GITHUB_REPOSITORY;
	if (fromEnv?.trim()) {
		return fromEnv.trim();
	}

	const processHandle = Bun.spawn({
		cmd: ["git", "remote", "get-url", "origin"],
		cwd: projectRoot,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, code] = await Promise.all([
		new Response(processHandle.stdout).text(),
		processHandle.exited,
	]);
	if (code !== 0) {
		return null;
	}

	const remote = stdout.trim();
	const sshMatch = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(remote);
	if (sshMatch) {
		return `${sshMatch[1]}/${sshMatch[2]}`;
	}

	const httpsMatch = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(remote);
	if (httpsMatch) {
		return `${httpsMatch[1]}/${httpsMatch[2]}`;
	}

	return null;
};

await mkdir(distDir, { recursive: true });

await run([
	"bun",
	"build",
	"apps/cli/src/cli.ts",
	"--compile",
	"--target",
	"bun",
	"--outfile",
	join(distDir, "mimirmesh"),
]);

await run([
	"bun",
	"build",
	"apps/server/src/index.ts",
	"--compile",
	"--target",
	"bun",
	"--outfile",
	join(distDir, "mimirmesh-server"),
]);

await run([
	"bun",
	"build",
	"apps/client/src/index.ts",
	"--compile",
	"--target",
	"bun",
	"--outfile",
	join(distDir, "mimirmesh-client"),
]);

await copyFile(join(distDir, "mimirmesh"), join(distDir, "mm"));

const runtimeAssetsSource = join(projectRoot, "docker", "images");
const runtimeAssetsTarget = join(distDir, "mimirmesh-assets", "docker", "images");
await rm(runtimeAssetsTarget, { recursive: true, force: true });
await mkdir(join(distDir, "mimirmesh-assets", "docker"), { recursive: true });
await cp(runtimeAssetsSource, runtimeAssetsTarget, { recursive: true });
await writeBundledSkillAssets(join(distDir, "mimirmesh-assets", "skills"));

const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8")) as {
	version?: string;
};
const repository = await resolveRepository();
const builtAt = new Date().toISOString();
const buildId = `${packageJson.version ?? "0.0.0"}+${builtAt}`;

await writeFile(
	join(distDir, "manifest.json"),
	`${JSON.stringify(
		{
			version: packageJson.version ?? "0.0.0",
			repository,
			builtAt,
			buildId,
			artifacts: ["mimirmesh", "mm", "mimirmesh-server", "mimirmesh-client", "mimirmesh-assets"],
		},
		null,
		2,
	)}\n`,
	"utf8",
);

process.stdout.write(`Build complete. Artifacts written to ${distDir}\n`);
