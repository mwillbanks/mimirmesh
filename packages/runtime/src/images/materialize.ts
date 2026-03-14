import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const runtimeImagesRoot = (projectRoot: string): string =>
	join(projectRoot, ".mimirmesh", "runtime", "images");

const assetRoots = ["common", "srclight", "document-mcp", "adr-analysis", "codebase-memory"];
const requiredAssetFiles = [
	"common/engine-bridge.mjs",
	"srclight/Dockerfile",
	"srclight/Dockerfile.cpu",
	"document-mcp/Dockerfile",
	"adr-analysis/Dockerfile",
	"codebase-memory/Dockerfile",
];

const sourceCheckoutAssetsRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
	"..",
	"docker",
	"images",
);

const isValidRuntimeAssetsRoot = (root: string): boolean =>
	requiredAssetFiles.every((relativePath) => existsSync(join(root, relativePath)));

const assetRootCandidates = (projectRoot: string): string[] => {
	const execDir = dirname(process.execPath);
	const override = process.env.MIMIRMESH_RUNTIME_ASSETS_DIR;

	return [
		override ? resolve(override) : null,
		join(projectRoot, "docker", "images"),
		join(process.cwd(), "docker", "images"),
		sourceCheckoutAssetsRoot,
		join(execDir, "mimirmesh-assets", "docker", "images"),
		join(execDir, ".mimirmesh-assets", "docker", "images"),
	].filter((candidate): candidate is string => Boolean(candidate));
};

const resolveRuntimeAssetsRoot = (projectRoot: string): string => {
	for (const candidate of assetRootCandidates(projectRoot)) {
		if (isValidRuntimeAssetsRoot(candidate)) {
			return candidate;
		}
	}

	throw new Error(
		[
			"Unable to locate MímirMesh runtime image assets.",
			"Checked:",
			...assetRootCandidates(projectRoot).map((candidate) => `- ${candidate}`),
			"Expected bundled runtime assets containing the checked-in Docker image definitions.",
		].join("\n"),
	);
};

const readCheckedInAsset = async (
	assetsRoot: string,
	relativePath: string,
): Promise<string | null> => {
	try {
		return await readFile(join(assetsRoot, relativePath), "utf8");
	} catch {
		return null;
	}
};

const listAssetFiles = async (assetsRoot: string, relativeRoot: string): Promise<string[]> => {
	const absoluteRoot = join(assetsRoot, relativeRoot);

	try {
		const entries = await readdir(absoluteRoot, { withFileTypes: true });
		const files: string[] = [];

		for (const entry of entries) {
			const relativePath = join(relativeRoot, entry.name);
			if (entry.isDirectory()) {
				files.push(...(await listAssetFiles(assetsRoot, relativePath)));
				continue;
			}

			files.push(relativePath);
		}

		return files;
	} catch {
		return [];
	}
};

export const materializeRuntimeImages = async (
	projectRoot: string,
): Promise<{
	root: string;
	files: string[];
}> => {
	const root = runtimeImagesRoot(projectRoot);
	const assetsRoot = resolveRuntimeAssetsRoot(projectRoot);
	const written: string[] = [];
	const assetFiles = (
		await Promise.all(assetRoots.map((relativeRoot) => listAssetFiles(assetsRoot, relativeRoot)))
	).flat();

	for (const relativePath of assetFiles) {
		const target = join(root, relativePath);
		const checkedInContent = await readCheckedInAsset(assetsRoot, relativePath);
		if (checkedInContent === null) {
			continue;
		}

		await mkdir(dirname(target), { recursive: true });
		const normalized = checkedInContent.endsWith("\n") ? checkedInContent : `${checkedInContent}\n`;
		await writeFile(target, normalized, "utf8");
		written.push(target);
	}

	return {
		root,
		files: written,
	};
};

export const runtimeImageAssetsRoot = runtimeImagesRoot;
