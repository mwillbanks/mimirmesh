import {
	access,
	chmod,
	copyFile,
	cp,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { MimirmeshConfig } from "@mimirmesh/config";
import type { InstallTarget } from "./install-policy";

export type UpdateCheckResult = {
	currentVersion: string;
	latestVersion: string;
	updateAvailable: boolean;
	source: "github" | "local";
};

export type InstallResult = {
	binaryPath: string;
	aliasPath: string;
	serverPath: string | null;
	clientPath: string | null;
	verified: boolean;
};

export type {
	InstallAreaId,
	InstallAreaKind,
	InstallationArea,
	InstallationPolicy,
	InstallationPreset,
	InstallMode,
	InstallPresetId,
	InstallSelectionState,
	InstallTarget,
} from "./install-policy";
export {
	createInstallationAreas,
	createInstallationPolicy,
	installAreaCatalog,
	installPresetCatalog,
	installTargetCatalog,
	isInstallAreaId,
	isInstallPresetId,
	resolveInstallAreas,
	resolveInstallPreset,
	validateInstallationPolicy,
} from "./install-policy";
export type {
	DetectedInstallArtifact,
	InstallationStateSnapshot,
	InstallChangeSummary,
} from "./install-state";
export { buildInstallChangeSummary, createInstallationStateSnapshot } from "./install-state";

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

const parseGitHubRepository = (remote: string): string | null => {
	const trimmed = remote.trim();
	if (!trimmed) {
		return null;
	}

	const sshMatch = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(trimmed);
	if (sshMatch) {
		return `${sshMatch[1]}/${sshMatch[2]}`;
	}

	const httpsMatch = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(trimmed);
	if (httpsMatch) {
		return `${httpsMatch[1]}/${httpsMatch[2]}`;
	}

	return null;
};

const readInstalledManifest = async (
	targetBinDir: string,
): Promise<{ version?: string; repository?: string } | null> => {
	const manifestPath = join(targetBinDir, "manifest.json");
	if (!(await pathExists(manifestPath))) {
		return null;
	}

	try {
		const raw = await readFile(manifestPath, "utf8");
		return JSON.parse(raw) as { version?: string; repository?: string };
	} catch {
		return null;
	}
};

const resolveGitHubRepository = async (
	projectRoot: string,
	targetBinDir?: string,
	overrideRepository?: string,
): Promise<string | null> => {
	if (overrideRepository?.trim()) {
		return overrideRepository.trim();
	}

	const fromEnv = process.env.MIMIRMESH_GITHUB_REPOSITORY ?? process.env.GITHUB_REPOSITORY;
	if (fromEnv?.trim()) {
		return fromEnv.trim();
	}

	if (targetBinDir) {
		const manifest = await readInstalledManifest(targetBinDir);
		if (manifest?.repository?.trim()) {
			return manifest.repository.trim();
		}
	}

	const remoteResult = await run(["git", "-C", projectRoot, "remote", "get-url", "origin"]);
	if (remoteResult.code === 0) {
		return parseGitHubRepository(remoteResult.stdout);
	}

	return null;
};

const mapPlatform = (platform: NodeJS.Platform): string | null => {
	if (platform === "darwin") {
		return "darwin";
	}
	if (platform === "linux") {
		return "linux";
	}
	return null;
};

const mapArch = (arch: string): string | null => {
	if (arch === "x64") {
		return "x64";
	}
	if (arch === "arm64" || arch === "aarch64") {
		return "arm64";
	}
	return null;
};

type GitHubReleaseMetadata = {
	tagName: string;
	version: string;
	htmlUrl: string;
};

const parseReleaseMetadata = (payload: unknown): GitHubReleaseMetadata | null => {
	if (!payload || typeof payload !== "object") {
		return null;
	}

	const raw = payload as { tag_name?: unknown; html_url?: unknown };
	if (typeof raw.tag_name !== "string" || !raw.tag_name.trim()) {
		return null;
	}

	return {
		tagName: raw.tag_name.trim(),
		version: raw.tag_name.trim().replace(/^v/i, ""),
		htmlUrl: typeof raw.html_url === "string" ? raw.html_url : "",
	};
};

const fetchReleaseMetadata = async (
	repository: string,
	channel: MimirmeshConfig["update"]["channel"],
): Promise<GitHubReleaseMetadata | null> => {
	const headers = {
		Accept: "application/vnd.github+json",
		"User-Agent": "mimirmesh-installer",
	};

	if (channel === "stable") {
		const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
			headers,
		});
		if (!response.ok) {
			return null;
		}
		const payload = await response.json();
		return parseReleaseMetadata(payload);
	}

	const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=40`, {
		headers,
	});
	if (!response.ok) {
		return null;
	}

	const releases = (await response.json()) as Array<{ tag_name?: string; prerelease?: boolean }>;
	const match = releases.find((release) => {
		if (!release.tag_name) {
			return false;
		}
		if (channel === "beta") {
			return /beta/i.test(release.tag_name) || release.prerelease === true;
		}
		return /nightly|canary/i.test(release.tag_name) || release.prerelease === true;
	});

	if (!match) {
		return null;
	}

	return parseReleaseMetadata(match);
};

const resolveCurrentVersion = async (
	projectRoot: string,
	targetBinDir?: string,
): Promise<string> => {
	if (targetBinDir) {
		const manifest = await readInstalledManifest(targetBinDir);
		if (manifest?.version?.trim()) {
			return manifest.version.trim();
		}
	}

	return getCurrentVersion(projectRoot);
};

const downloadReleaseArtifacts = async (options: {
	repository: string;
	tagName: string;
	workingDirectory: string;
}): Promise<string> => {
	const platform = mapPlatform(process.platform);
	const arch = mapArch(process.arch);
	if (!platform || !arch) {
		throw new Error(
			`Unsupported platform for release artifacts: ${process.platform}/${process.arch}. Use local artifacts instead.`,
		);
	}

	const archiveName = `mimirmesh-${platform}-${arch}.tar.gz`;
	const downloadUrl = `https://github.com/${options.repository}/releases/download/${options.tagName}/${archiveName}`;
	const archivePath = join(options.workingDirectory, archiveName);

	const response = await fetch(downloadUrl, {
		headers: {
			Accept: "application/octet-stream",
			"User-Agent": "mimirmesh-installer",
		},
	});
	if (!response.ok) {
		throw new Error(`Failed to download release artifact ${archiveName} (${response.status}).`);
	}

	const bytes = new Uint8Array(await response.arrayBuffer());
	await writeFile(archivePath, bytes);

	const extractResult = await run(["tar", "-xzf", archivePath, "-C", options.workingDirectory]);
	if (extractResult.code !== 0) {
		throw new Error(
			`Failed to extract release artifact: ${extractResult.stderr || extractResult.stdout}`,
		);
	}

	return options.workingDirectory;
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
	options?: { targetBinDir?: string; repository?: string },
): Promise<UpdateCheckResult> => {
	const currentVersion = await resolveCurrentVersion(projectRoot, options?.targetBinDir);
	const repository = await resolveGitHubRepository(
		projectRoot,
		options?.targetBinDir,
		options?.repository,
	);
	if (!repository) {
		return {
			currentVersion,
			latestVersion: currentVersion,
			updateAvailable: false,
			source: "local",
		};
	}

	const release = await fetchReleaseMetadata(repository, channel);
	if (!release) {
		return {
			currentVersion,
			latestVersion: currentVersion,
			updateAvailable: false,
			source: "local",
		};
	}

	const latestVersion = release.version || currentVersion;
	return {
		currentVersion,
		latestVersion,
		updateAvailable: isVersionGreater(latestVersion, currentVersion),
		source: "github",
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
		env: {
			MIMIRMESH_MODE: "local",
			MIMIRMESH_PROJECT_ROOT: options.projectRoot,
		},
	};
	const normalizedServerEntry =
		serverArgs.length > 0 ? { ...serverEntry, args: serverArgs } : serverEntry;
	const content = {
		[rootKey]: {
			mimirmesh: normalizedServerEntry,
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
					mimirmesh: normalizedServerEntry,
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
	targetBinDir: string;
	artifactDir?: string;
	channel?: MimirmeshConfig["update"]["channel"];
	repository?: string;
}): Promise<{ applied: boolean; details: string }> => {
	const channel = options.channel ?? "stable";
	const currentVersion = await resolveCurrentVersion(options.projectRoot, options.targetBinDir);
	const repository = await resolveGitHubRepository(
		options.projectRoot,
		options.targetBinDir,
		options.repository,
	);
	const updateInfo = await checkForUpdates(options.projectRoot, channel, {
		targetBinDir: options.targetBinDir,
		repository: repository ?? undefined,
	});
	if (!updateInfo.updateAvailable && updateInfo.source === "github") {
		return {
			applied: false,
			details: `Already up to date (${currentVersion}).`,
		};
	}

	let installResult: InstallResult | null = null;
	let githubFailure: string | null = null;

	if (repository) {
		try {
			const release = await fetchReleaseMetadata(repository, channel);
			if (release) {
				const tempDir = await mkdtemp(join(tmpdir(), "mimirmesh-update-"));
				try {
					const artifactDir = await downloadReleaseArtifacts({
						repository,
						tagName: release.tagName,
						workingDirectory: tempDir,
					});
					installResult = await installFromArtifacts({
						artifactDir,
						targetBinDir: options.targetBinDir,
					});
				} finally {
					await rm(tempDir, { recursive: true, force: true });
				}
			}
		} catch (error) {
			githubFailure = error instanceof Error ? error.message : String(error);
		}
	}

	if (!installResult && options.artifactDir) {
		installResult = await installFromArtifacts({
			artifactDir: options.artifactDir,
			targetBinDir: options.targetBinDir,
		});
	}

	if (!installResult) {
		return {
			applied: false,
			details: githubFailure
				? `Unable to download release artifacts (${githubFailure}). Set MIMIRMESH_GITHUB_REPOSITORY or provide local dist artifacts.`
				: "No release artifacts were available and no local artifact directory was provided.",
		};
	}

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
