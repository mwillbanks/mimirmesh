export type ReleaseArchiveFormat = "tar.gz" | "zip";

export type ReleaseTargetSpec = {
	id: string;
	bunTarget: string;
	platform: "darwin" | "linux" | "windows";
	arch: "x64" | "arm64";
	archiveFormat: ReleaseArchiveFormat;
	executableExtension: "" | ".exe";
};

export const RELEASE_TARGETS: readonly ReleaseTargetSpec[] = [
	{
		id: "darwin-x64",
		bunTarget: "bun-darwin-x64",
		platform: "darwin",
		arch: "x64",
		archiveFormat: "tar.gz",
		executableExtension: "",
	},
	{
		id: "darwin-arm64",
		bunTarget: "bun-darwin-arm64",
		platform: "darwin",
		arch: "arm64",
		archiveFormat: "tar.gz",
		executableExtension: "",
	},
	{
		id: "linux-x64",
		bunTarget: "bun-linux-x64",
		platform: "linux",
		arch: "x64",
		archiveFormat: "tar.gz",
		executableExtension: "",
	},
	{
		id: "linux-arm64",
		bunTarget: "bun-linux-arm64",
		platform: "linux",
		arch: "arm64",
		archiveFormat: "tar.gz",
		executableExtension: "",
	},
	{
		id: "windows-x64",
		bunTarget: "bun-windows-x64",
		platform: "windows",
		arch: "x64",
		archiveFormat: "zip",
		executableExtension: ".exe",
	},
	{
		id: "windows-arm64",
		bunTarget: "bun-windows-arm64",
		platform: "windows",
		arch: "arm64",
		archiveFormat: "zip",
		executableExtension: ".exe",
	},
] as const;

export const EXECUTABLE_ARTIFACT_BASENAMES = [
	"mimirmesh",
	"mm",
	"mimirmesh-server",
	"mimirmesh-client",
] as const;

export const RELEASE_MANIFEST_FILENAME = "manifest.json";

export const getExecutableArtifactNames = (
	target: Pick<ReleaseTargetSpec, "executableExtension">,
): string[] => EXECUTABLE_ARTIFACT_BASENAMES.map((name) => `${name}${target.executableExtension}`);

export const getTargetArtifactNames = (
	target: Pick<ReleaseTargetSpec, "executableExtension">,
): string[] => [...getExecutableArtifactNames(target), RELEASE_MANIFEST_FILENAME];

export const getReleaseBuildDirName = (
	target: Pick<ReleaseTargetSpec, "platform" | "arch">,
): string => `${target.platform}-${target.arch}`;

export const getArchiveExtension = (target: Pick<ReleaseTargetSpec, "archiveFormat">): string =>
	target.archiveFormat;

export const getVersionedArchiveName = (
	version: string,
	target: Pick<ReleaseTargetSpec, "platform" | "arch" | "archiveFormat">,
): string =>
	`mimirmesh-${version}-${target.platform}-${target.arch}.${getArchiveExtension(target)}`;

export const getChannelArchiveName = (
	target: Pick<ReleaseTargetSpec, "platform" | "arch" | "archiveFormat">,
): string => `mimirmesh-${target.platform}-${target.arch}.${getArchiveExtension(target)}`;

export const findReleaseTarget = (platform: string, arch: string): ReleaseTargetSpec | undefined =>
	RELEASE_TARGETS.find((target) => target.platform === platform && target.arch === arch);
