import { chmod, copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = process.cwd();
const distDir = join(projectRoot, "dist");
const releaseDir = join(distDir, "releases");

const run = async (cmd: string[]): Promise<{ code: number; stdout: string; stderr: string }> => {
	const process = Bun.spawn({ cmd, cwd: projectRoot, stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr, code] = await Promise.all([
		new Response(process.stdout).text(),
		new Response(process.stderr).text(),
		process.exited,
	]);
	return { code, stdout, stderr };
};

const mustRun = async (cmd: string[]): Promise<{ stdout: string; stderr: string }> => {
	const result = await run(cmd);
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

const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8")) as {
	version?: string;
};
const version = packageJson.version ?? "0.0.0";
const platform = mapPlatform(process.platform);
const arch = mapArch(process.arch);
const repository = await resolveRepository();

const binaries = [
	"mimirmesh",
	"mm",
	"mimirmesh-server",
	"mimirmesh-client",
	"manifest.json",
] as const;
for (const file of binaries) {
	await Bun.file(join(distDir, file))
		.exists()
		.then((exists) => {
			if (!exists) {
				throw new Error(`Missing required artifact: dist/${file}. Run 'bun run build' first.`);
			}
		});
}

await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });

const stageDir = join(releaseDir, `mimirmesh-${version}-${platform}-${arch}`);
await rm(stageDir, { recursive: true, force: true });
await mkdir(stageDir, { recursive: true });

for (const file of binaries) {
	await copyFile(join(distDir, file), join(stageDir, file));
}

const assetsDir = join(distDir, "mimirmesh-assets");
if (await Bun.file(assetsDir).exists()) {
	await cp(assetsDir, join(stageDir, "mimirmesh-assets"), { recursive: true });
}

const versionedArchiveName = `mimirmesh-${version}-${platform}-${arch}.tar.gz`;
const channelArchiveName = `mimirmesh-${platform}-${arch}.tar.gz`;

await mustRun(["tar", "-czf", join(releaseDir, versionedArchiveName), "-C", stageDir, "."]);
await copyFile(join(releaseDir, versionedArchiveName), join(releaseDir, channelArchiveName));

const installScript = `#!/usr/bin/env bash
set -euo pipefail

REPO="\${MIMIRMESH_GITHUB_REPOSITORY:-${repository}}"
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

await writeFile(join(releaseDir, "install.sh"), installScript, "utf8");
await chmod(join(releaseDir, "install.sh"), 0o755);

const checksumProcess = Bun.spawn({
	cmd: ["shasum", "-a", "256", versionedArchiveName, channelArchiveName, "install.sh"],
	cwd: releaseDir,
	stdout: "pipe",
	stderr: "pipe",
});
const [checksums, checksumStderr, checksumCode] = await Promise.all([
	new Response(checksumProcess.stdout).text(),
	new Response(checksumProcess.stderr).text(),
	checksumProcess.exited,
]);
if (checksumCode !== 0) {
	throw new Error(`Failed to compute checksums: ${checksumStderr || checksums}`);
}
await writeFile(join(releaseDir, "checksums.txt"), checksums, "utf8");

await rm(stageDir, { recursive: true, force: true });

process.stdout.write(
	`Release assets prepared in ${releaseDir}\n- ${versionedArchiveName}\n- ${channelArchiveName}\n- install.sh\n- checksums.txt\nRepository: ${repository}\n`,
);
