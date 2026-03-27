import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { writeBundledSkillAssets } from "../packages/skills/src/index";
import {
	EXECUTABLE_ARTIFACT_BASENAMES,
	getReleaseBuildDirName,
	getTargetArtifactNames,
	RELEASE_TARGETS,
} from "./lib/release-metadata";

const projectRoot = process.cwd();
const distDir = join(projectRoot, "dist");
const releaseBuildsDir = join(distDir, "release-builds");
const isReleaseBuild = Bun.argv.includes("--release");

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

const copyBundledAssets = async (targetRoot: string): Promise<void> => {
	const runtimeAssetsSource = join(projectRoot, "docker", "images");
	const runtimeAssetsTarget = join(targetRoot, "mimirmesh-assets", "docker", "images");
	await rm(runtimeAssetsTarget, { recursive: true, force: true });
	await mkdir(join(targetRoot, "mimirmesh-assets", "docker"), { recursive: true });
	await cp(runtimeAssetsSource, runtimeAssetsTarget, { recursive: true });
	await writeBundledSkillAssets(join(targetRoot, "mimirmesh-assets", "skills"));
};

const buildBinary = async (entrypoint: string, outfile: string, target?: string): Promise<void> => {
	const cmd = ["bun", "build", entrypoint, "--compile"];
	if (target) {
		cmd.push("--target", target);
	} else {
		cmd.push("--target", "bun");
	}
	cmd.push("--outfile", outfile);
	await run(cmd);
};

const writeManifest = async (
	artifactRoot: string,
	artifacts: readonly string[],
	options: {
		version: string;
		repository: string | null;
		builtAt: string;
		buildId: string;
		target?: { platform: string; arch: string; bunTarget: string };
	},
): Promise<void> => {
	await writeFile(
		join(artifactRoot, "manifest.json"),
		`${JSON.stringify(
			{
				version: options.version,
				repository: options.repository,
				builtAt: options.builtAt,
				buildId: options.buildId,
				artifacts,
				...(options.target ? { target: options.target } : {}),
			},
			null,
			2,
		)}\n`,
		"utf8",
	);
};

const buildHostArtifacts = async (
	version: string,
	repository: string | null,
	builtAt: string,
	buildId: string,
): Promise<void> => {
	await rm(releaseBuildsDir, { recursive: true, force: true });
	await buildBinary("apps/cli/src/cli.ts", join(distDir, "mimirmesh"));
	await buildBinary("apps/server/src/index.ts", join(distDir, "mimirmesh-server"));
	await buildBinary("apps/client/src/index.ts", join(distDir, "mimirmesh-client"));
	await copyFile(join(distDir, "mimirmesh"), join(distDir, "mm"));
	await copyBundledAssets(distDir);
	await writeManifest(distDir, [...EXECUTABLE_ARTIFACT_BASENAMES, "mimirmesh-assets"], {
		version,
		repository,
		builtAt,
		buildId,
	});
};

const buildReleaseArtifacts = async (
	version: string,
	repository: string | null,
	builtAt: string,
	buildId: string,
): Promise<void> => {
	await rm(releaseBuildsDir, { recursive: true, force: true });
	await mkdir(releaseBuildsDir, { recursive: true });
	await copyBundledAssets(distDir);

	for (const target of RELEASE_TARGETS) {
		const targetDir = join(releaseBuildsDir, getReleaseBuildDirName(target));
		await mkdir(targetDir, { recursive: true });

		await buildBinary(
			"apps/cli/src/cli.ts",
			join(targetDir, `mimirmesh${target.executableExtension}`),
			target.bunTarget,
		);
		await buildBinary(
			"apps/server/src/index.ts",
			join(targetDir, `mimirmesh-server${target.executableExtension}`),
			target.bunTarget,
		);
		await buildBinary(
			"apps/client/src/index.ts",
			join(targetDir, `mimirmesh-client${target.executableExtension}`),
			target.bunTarget,
		);
		await copyFile(
			join(targetDir, `mimirmesh${target.executableExtension}`),
			join(targetDir, `mm${target.executableExtension}`),
		);

		await writeManifest(targetDir, [...getTargetArtifactNames(target), "mimirmesh-assets"], {
			version,
			repository,
			builtAt,
			buildId,
			target: {
				platform: target.platform,
				arch: target.arch,
				bunTarget: target.bunTarget,
			},
		});
	}
};

await mkdir(distDir, { recursive: true });

const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8")) as {
	version?: string;
};
const repository = await resolveRepository();
const builtAt = new Date().toISOString();
const buildId = `${packageJson.version ?? "0.0.0"}+${builtAt}`;

if (isReleaseBuild) {
	await buildReleaseArtifacts(packageJson.version ?? "0.0.0", repository, builtAt, buildId);
	process.stdout.write(`Release build complete. Artifacts written to ${releaseBuildsDir}\n`);
} else {
	await buildHostArtifacts(packageJson.version ?? "0.0.0", repository, builtAt, buildId);
	process.stdout.write(`Build complete. Artifacts written to ${distDir}\n`);
}
