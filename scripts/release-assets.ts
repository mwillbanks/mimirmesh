import { createHash } from "node:crypto";
import {
	chmod,
	copyFile,
	cp,
	mkdir,
	readdir,
	readFile,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import {
	findReleaseTarget,
	getChannelArchiveName,
	getReleaseBuildDirName,
	getTargetArtifactNames,
	getVersionedArchiveName,
	RELEASE_TARGETS,
} from "./lib/release-metadata";

const projectRoot = process.cwd();
const distDir = join(projectRoot, "dist");
const releaseDir = join(distDir, "releases");
const releaseBuildsDir = join(distDir, "release-builds");

const run = async (
	cmd: string[],
	options?: { cwd?: string },
): Promise<{ code: number; stdout: string; stderr: string }> => {
	const process = Bun.spawn({
		cmd,
		cwd: options?.cwd ?? projectRoot,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, code] = await Promise.all([
		new Response(process.stdout).text(),
		new Response(process.stderr).text(),
		process.exited,
	]);
	return { code, stdout, stderr };
};

const mustRun = async (
	cmd: string[],
	options?: { cwd?: string },
): Promise<{ stdout: string; stderr: string }> => {
	const result = await run(cmd, options);
	if (result.code !== 0) {
		throw new Error(`Command failed (${result.code}): ${cmd.join(" ")}\n${result.stderr}`);
	}
	return { stdout: result.stdout, stderr: result.stderr };
};

const mapPlatform = (platform: NodeJS.Platform): string => {
	if (platform === "darwin") {
		return "darwin";
	}
	if (platform === "linux") {
		return "linux";
	}
	if (platform === "win32") {
		return "windows";
	}
	return platform;
};

const mapArch = (arch: string): string => {
	if (arch === "x64") {
		return "x64";
	}
	if (arch === "arm64") {
		return "arm64";
	}
	if (arch === "aarch64") {
		return "arm64";
	}
	return arch;
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

const resolveRepository = async (): Promise<string> => {
	const fromEnv = process.env.MIMIRMESH_GITHUB_REPOSITORY ?? process.env.GITHUB_REPOSITORY;
	if (fromEnv?.trim()) {
		return fromEnv.trim();
	}

	const remote = await run(["git", "remote", "get-url", "origin"]);
	if (remote.code === 0) {
		const parsed = parseGitHubRepository(remote.stdout.trim());
		if (parsed) {
			return parsed;
		}
	}

	throw new Error(
		"Unable to determine GitHub repository. Set MIMIRMESH_GITHUB_REPOSITORY=<owner>/<repo> before running release assets.",
	);
};

const pathExists = async (path: string): Promise<boolean> => {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
};

const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8")) as {
	version?: string;
};
const version = packageJson.version ?? "0.0.0";
const repository = await resolveRepository();

const createBashInstallScript = (repo: string): string => `#!/usr/bin/env bash
set -euo pipefail

REPO="\${MIMIRMESH_GITHUB_REPOSITORY:-${repo}}"
INSTALL_DIR="\${MIMIRMESH_INSTALL_DIR:-$HOME/.local/bin}"

os="$(uname -s)"
arch="$(uname -m)"

case "$os" in
  Darwin) platform="darwin" ;;
  Linux) platform="linux" ;;
  *)
		echo "Unsupported OS: $os" >&2
    exit 1
    ;;
esac

case "$arch" in
  x86_64|amd64) arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  *)
		echo "Unsupported architecture: $arch" >&2
    exit 1
    ;;
esac

asset="mimirmesh-\${platform}-\${arch}.tar.gz"
url="https://github.com/\${REPO}/releases/latest/download/\${asset}"

tmp="$(mktemp -d)"
cleanup() { rm -rf "$tmp"; }
trap cleanup EXIT

if command -v curl >/dev/null 2>&1; then
	curl -fsSL "$url" -o "$tmp/$asset"
elif command -v wget >/dev/null 2>&1; then
	wget -qO "$tmp/$asset" "$url"
else
  echo "curl or wget is required" >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
tar -xzf "$tmp/$asset" -C "$tmp"

cp "$tmp/mimirmesh" "$INSTALL_DIR/mimirmesh"
cp "$tmp/mm" "$INSTALL_DIR/mm"
chmod +x "$INSTALL_DIR/mimirmesh" "$INSTALL_DIR/mm"

if [[ -f "$tmp/mimirmesh-server" ]]; then
	cp "$tmp/mimirmesh-server" "$INSTALL_DIR/mimirmesh-server"
	chmod +x "$INSTALL_DIR/mimirmesh-server"
fi

if [[ -f "$tmp/mimirmesh-client" ]]; then
	cp "$tmp/mimirmesh-client" "$INSTALL_DIR/mimirmesh-client"
	chmod +x "$INSTALL_DIR/mimirmesh-client"
fi

if [[ -f "$tmp/manifest.json" ]]; then
	cp "$tmp/manifest.json" "$INSTALL_DIR/manifest.json"
fi

if [[ -d "$tmp/mimirmesh-assets" ]]; then
	rm -rf "$INSTALL_DIR/mimirmesh-assets"
	cp -R "$tmp/mimirmesh-assets" "$INSTALL_DIR/mimirmesh-assets"
fi

echo "Installed MimirMesh to $INSTALL_DIR"
"$INSTALL_DIR/mimirmesh" --version
`;

const createPowerShellInstallScript = (repo: string): string => `#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$repo = if ($env:MIMIRMESH_GITHUB_REPOSITORY) { $env:MIMIRMESH_GITHUB_REPOSITORY } else { "${repo}" }
$installDir = if ($env:MIMIRMESH_INSTALL_DIR) {
	$env:MIMIRMESH_INSTALL_DIR
} elseif ($env:LOCALAPPDATA) {
	Join-Path $env:LOCALAPPDATA "MimirMesh\\bin"
} else {
	Join-Path $HOME "AppData\\Local\\MimirMesh\\bin"
}

$arch = switch ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()) {
	"X64" { "x64" }
	"Arm64" { "arm64" }
	default { throw "Unsupported architecture: $($_)" }
}

$asset = "mimirmesh-windows-$arch.zip"
$url = "https://github.com/$repo/releases/latest/download/$asset"
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
$archivePath = Join-Path $tempDir $asset

New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
	Invoke-WebRequest -Uri $url -OutFile $archivePath
	Expand-Archive -Path $archivePath -DestinationPath $tempDir -Force

	New-Item -ItemType Directory -Path $installDir -Force | Out-Null

	Copy-Item (Join-Path $tempDir "mimirmesh.exe") (Join-Path $installDir "mimirmesh.exe") -Force
	Copy-Item (Join-Path $tempDir "mm.exe") (Join-Path $installDir "mm.exe") -Force

	if (Test-Path (Join-Path $tempDir "mimirmesh-server.exe")) {
		Copy-Item (Join-Path $tempDir "mimirmesh-server.exe") (Join-Path $installDir "mimirmesh-server.exe") -Force
	}

	if (Test-Path (Join-Path $tempDir "mimirmesh-client.exe")) {
		Copy-Item (Join-Path $tempDir "mimirmesh-client.exe") (Join-Path $installDir "mimirmesh-client.exe") -Force
	}

	if (Test-Path (Join-Path $tempDir "manifest.json")) {
		Copy-Item (Join-Path $tempDir "manifest.json") (Join-Path $installDir "manifest.json") -Force
	}

	if (Test-Path (Join-Path $tempDir "mimirmesh-assets")) {
		$assetsTarget = Join-Path $installDir "mimirmesh-assets"
		if (Test-Path $assetsTarget) {
			Remove-Item $assetsTarget -Recurse -Force
		}
		Copy-Item (Join-Path $tempDir "mimirmesh-assets") $assetsTarget -Recurse -Force
	}

	Write-Host "Installed MimirMesh to $installDir"
	& (Join-Path $installDir "mimirmesh.exe") --version
} finally {
	if (Test-Path $tempDir) {
		Remove-Item $tempDir -Recurse -Force
	}
}
`;

const ensureArtifactsExist = async (
	artifactRoot: string,
	files: readonly string[],
): Promise<void> => {
	for (const file of files) {
		const exists = await Bun.file(join(artifactRoot, file)).exists();
		if (!exists) {
			throw new Error(
				`Missing required artifact: ${artifactRoot.replace(`${projectRoot}/`, "")}/${file}. Run the build step first.`,
			);
		}
	}
};

type PackagingTarget = {
	artifactRoot: string;
	platform: "darwin" | "linux" | "windows";
	arch: "x64" | "arm64";
	archiveFormat: "tar.gz" | "zip";
	executableExtension: "" | ".exe";
};

const resolvePackagingTargets = async (): Promise<PackagingTarget[]> => {
	const hasReleaseBuilds = await pathExists(releaseBuildsDir);
	if (!hasReleaseBuilds) {
		const platform = mapPlatform(process.platform);
		const arch = mapArch(process.arch);
		const target = findReleaseTarget(platform, arch);
		if (!target) {
			throw new Error(`Unsupported host release target: ${platform}-${arch}`);
		}
		await ensureArtifactsExist(distDir, getTargetArtifactNames(target));
		return [
			{
				artifactRoot: distDir,
				platform: target.platform,
				arch: target.arch,
				archiveFormat: target.archiveFormat,
				executableExtension: target.executableExtension,
			},
		];
	}

	const releaseBuildEntries = await readdir(releaseBuildsDir, { withFileTypes: true });
	const releaseBuildDirNames = new Set(
		releaseBuildEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
	);

	for (const target of RELEASE_TARGETS) {
		const dirName = getReleaseBuildDirName(target);
		if (!releaseBuildDirNames.has(dirName)) {
			throw new Error(`Missing release build target directory: dist/release-builds/${dirName}`);
		}
	}

	const targets: PackagingTarget[] = [];
	for (const target of RELEASE_TARGETS) {
		const artifactRoot = join(releaseBuildsDir, getReleaseBuildDirName(target));
		await ensureArtifactsExist(artifactRoot, getTargetArtifactNames(target));
		targets.push({
			artifactRoot,
			platform: target.platform,
			arch: target.arch,
			archiveFormat: target.archiveFormat,
			executableExtension: target.executableExtension,
		});
	}

	return targets;
};

const writeChecksums = async (files: readonly string[]): Promise<void> => {
	const checksums = await Promise.all(
		files.map(async (file) => {
			const contents = await readFile(join(releaseDir, file));
			const digest = createHash("sha256").update(contents).digest("hex");
			return `${digest}  ${file}`;
		}),
	);
	await writeFile(join(releaseDir, "checksums.txt"), `${checksums.join("\n")}\n`, "utf8");
};

await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });

const packagingTargets = await resolvePackagingTargets();
const releaseArtifacts: string[] = [];

for (const target of packagingTargets) {
	const stageDir = join(releaseDir, `mimirmesh-${version}-${target.platform}-${target.arch}`);
	await rm(stageDir, { recursive: true, force: true });
	await mkdir(stageDir, { recursive: true });

	for (const file of getTargetArtifactNames(target)) {
		await copyFile(join(target.artifactRoot, file), join(stageDir, file));
	}

	const assetsDir = join(distDir, "mimirmesh-assets");
	if (await pathExists(assetsDir)) {
		await cp(assetsDir, join(stageDir, "mimirmesh-assets"), { recursive: true });
	}

	const versionedArchiveName = getVersionedArchiveName(version, target);
	const channelArchiveName = getChannelArchiveName(target);
	if (target.archiveFormat === "tar.gz") {
		await mustRun(["tar", "-czf", join(releaseDir, versionedArchiveName), "-C", stageDir, "."]);
	} else {
		await mustRun(["zip", "-qr", join(releaseDir, versionedArchiveName), "."], { cwd: stageDir });
	}
	await copyFile(join(releaseDir, versionedArchiveName), join(releaseDir, channelArchiveName));
	releaseArtifacts.push(versionedArchiveName, channelArchiveName);

	await rm(stageDir, { recursive: true, force: true });
}

await writeFile(join(releaseDir, "install.sh"), createBashInstallScript(repository), "utf8");
await chmod(join(releaseDir, "install.sh"), 0o755);
await writeFile(join(releaseDir, "install.ps1"), createPowerShellInstallScript(repository), "utf8");
await writeChecksums([...releaseArtifacts, "install.sh", "install.ps1"]);

process.stdout.write(
	`Release assets prepared in ${releaseDir}\n- ${releaseArtifacts.join("\n- ")}\n- install.sh\n- install.ps1\n- checksums.txt\nRepository: ${repository}\n`,
);
