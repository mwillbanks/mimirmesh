import { access, chmod, copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { MimirmeshConfig } from "@mimirmesh/config";

export type InstallTarget = "vscode" | "cursor" | "claude" | "codex";

export type UpdateCheckResult = {
	currentVersion: string;
	latestVersion: string;
	updateAvailable: boolean;
	source: "npm" | "local";
};

export type InstallResult = {
	binaryPath: string;
	aliasPath: string;
	serverPath: string | null;
	clientPath: string | null;
	verified: boolean;
};

const parseSemver = (version: string): number[] =>
	version
		.replace(/^v/i, "")
		.split(".")
		.map((part) => Number.parseInt(part.replace(/[^0-9].*$/, ""), 10) || 0)
		.slice(0, 3);

const isVersionGreater = (candidate: string, baseline: string): boolean => {
	const left = parseSemver(candidate);
	const right = parseSemver(baseline);
	for (let index = 0; index < 3; index += 1) {
		const a = left[index] ?? 0;
		const b = right[index] ?? 0;
		if (a > b) {
			return true;
		}
		if (a < b) {
			return false;
		}
	}
	return false;
};

const pathExists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

const run = async (cmd: string[]): Promise<{ code: number; stdout: string; stderr: string }> => {
	const process = Bun.spawn({ cmd, stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr, code] = await Promise.all([
		new Response(process.stdout).text(),
		new Response(process.stderr).text(),
		process.exited,
	]);
	return { code, stdout, stderr };
};

export const getCurrentVersion = async (projectRoot: string): Promise<string> => {
	const packageJsonPath = join(projectRoot, "package.json");
	const raw = await readFile(packageJsonPath, "utf8");
	const packageJson = JSON.parse(raw) as { version?: string };
	return packageJson.version ?? "0.0.0";
};

export const checkForUpdates = async (
	projectRoot: string,
	channel: MimirmeshConfig["update"]["channel"] = "stable",
): Promise<UpdateCheckResult> => {
	const currentVersion = await getCurrentVersion(projectRoot);
	const packageName = channel === "stable" ? "mimirmesh" : `mimirmesh@${channel}`;
	const result = await run(["npm", "view", packageName, "version"]);
	if (result.code !== 0) {
		return {
			currentVersion,
			latestVersion: currentVersion,
			updateAvailable: false,
			source: "local",
		};
	}

	const latestVersion = result.stdout.trim() || currentVersion;
	return {
		currentVersion,
		latestVersion,
		updateAvailable: isVersionGreater(latestVersion, currentVersion),
		source: "npm",
	};
};

export const installFromArtifacts = async (options: {
	artifactDir: string;
	targetBinDir: string;
	programName?: string;
	aliasName?: string;
}): Promise<InstallResult> => {
	const programName = options.programName ?? "mimirmesh";
	const aliasName = options.aliasName ?? "mm";
	const sourceBinary = join(options.artifactDir, "mimirmesh");
	if (!(await pathExists(sourceBinary))) {
		throw new Error(`Missing build artifact: ${sourceBinary}`);
	}

	await mkdir(options.targetBinDir, { recursive: true });
	const binaryPath = join(options.targetBinDir, programName);
	const aliasPath = join(options.targetBinDir, aliasName);
	await copyFile(sourceBinary, binaryPath);
	await copyFile(sourceBinary, aliasPath);
	await chmod(binaryPath, 0o755);
	await chmod(aliasPath, 0o755);

	const maybeInstallBinary = async (filename: string): Promise<string | null> => {
		const source = join(options.artifactDir, filename);
		if (!(await pathExists(source))) {
			return null;
		}
		const target = join(options.targetBinDir, filename);
		await copyFile(source, target);
		await chmod(target, 0o755);
		return target;
	};
	const serverPath = await maybeInstallBinary("mimirmesh-server");
	const clientPath = await maybeInstallBinary("mimirmesh-client");
	const manifestPath = join(options.artifactDir, "manifest.json");
	if (await pathExists(manifestPath)) {
		await copyFile(manifestPath, join(options.targetBinDir, "manifest.json"));
	}
	const sourceAssets = join(options.artifactDir, "mimirmesh-assets");
	if (await pathExists(sourceAssets)) {
		const targetAssets = join(options.targetBinDir, "mimirmesh-assets");
		await rm(targetAssets, { recursive: true, force: true });
		await cp(sourceAssets, targetAssets, { recursive: true });
	}

	const verify = await run([binaryPath, "--help"]);
	return {
		binaryPath,
		aliasPath,
		serverPath,
		clientPath,
		verified: verify.code === 0,
	};
};

const ideDirectory = (projectRoot: string, target: InstallTarget): string => {
	if (target === "vscode") {
		return join(projectRoot, ".vscode");
	}
	if (target === "cursor") {
		return join(projectRoot, ".cursor");
	}
	if (target === "claude") {
		return join(projectRoot, ".claude");
	}
	return join(projectRoot, ".codex");
};

export const installIdeConfig = async (options: {
	projectRoot: string;
	target: InstallTarget;
	serverCommand: string;
	serverArgs?: string[];
}): Promise<string> => {
	const configDirectory = ideDirectory(options.projectRoot, options.target);
	await mkdir(configDirectory, { recursive: true });
	const configPath = join(configDirectory, "mcp.json");
	const serverArgs = options.serverArgs ?? [];
	const rootKey = options.target === "vscode" ? "servers" : "mcpServers";
	const serverEntry = {
		command: options.serverCommand,
		args: serverArgs,
		env: {
			MIMIRMESH_MODE: "local",
			MIMIRMESH_PROJECT_ROOT: options.projectRoot,
		},
	};
	const content = {
		[rootKey]: {
			mimirmesh: serverEntry,
		},
	};

	let merged: Record<string, unknown> = content;
	if (await pathExists(configPath)) {
		try {
			const existing = JSON.parse(await readFile(configPath, "utf8")) as {
				mcpServers?: Record<string, unknown>;
				servers?: Record<string, unknown>;
			};
			const existingRoot =
				rootKey === "servers" ? (existing.servers ?? {}) : (existing.mcpServers ?? {});
			merged = {
				...existing,
				[rootKey]: {
					...existingRoot,
					mimirmesh: serverEntry,
				},
			};
		} catch {
			// Keep deterministic config if existing file is malformed.
		}
	}

	await writeFile(configPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
	return configPath;
};

export const performUpdate = async (options: {
	projectRoot: string;
	artifactDir: string;
	targetBinDir: string;
}): Promise<{ applied: boolean; details: string }> => {
	const currentVersion = await getCurrentVersion(options.projectRoot);
	const updateInfo = await checkForUpdates(options.projectRoot);
	if (!updateInfo.updateAvailable && updateInfo.source === "npm") {
		return {
			applied: false,
			details: `Already up to date (${currentVersion}).`,
		};
	}

	const installResult = await installFromArtifacts({
		artifactDir: options.artifactDir,
		targetBinDir: options.targetBinDir,
	});
	if (!installResult.verified) {
		return {
			applied: false,
			details: "Update artifacts copied, but binary verification failed.",
		};
	}
	return {
		applied: true,
		details: `Installed ${updateInfo.latestVersion} to ${installResult.binaryPath}`,
	};
};

export const plannedInstallPaths = (
	homeDirectory: string,
): { binDir: string; artifactDir: string } => ({
	binDir: join(homeDirectory, ".local", "bin"),
	artifactDir: join(homeDirectory, ".mimirmesh", "artifacts"),
});

export const copyArtifactsToCache = async (options: {
	sourceDir: string;
	targetDir: string;
}): Promise<void> => {
	await mkdir(options.targetDir, { recursive: true });
	const files = ["mimirmesh", "mm", "mimirmesh-server", "mimirmesh-client"];
	for (const file of files) {
		const source = join(options.sourceDir, file);
		if (!(await pathExists(source))) {
			continue;
		}
		const target = join(options.targetDir, file);
		await mkdir(dirname(target), { recursive: true });
		await copyFile(source, target);
		await chmod(target, 0o755);
	}
	const sourceAssets = join(options.sourceDir, "mimirmesh-assets");
	if (await pathExists(sourceAssets)) {
		const targetAssets = join(options.targetDir, "mimirmesh-assets");
		await rm(targetAssets, { recursive: true, force: true });
		await cp(sourceAssets, targetAssets, { recursive: true });
	}
};
