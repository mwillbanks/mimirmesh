import { access, cp, mkdir, rm } from "node:fs/promises";
import { basename, isAbsolute, join, relative } from "node:path";

import type { BackupArtifact, BackupArtifactCategory, BackupManifest } from "@mimirmesh/config";
import { getConfigPath } from "@mimirmesh/config";
import { loadBackupManifest, persistBackupManifest } from "../state/io";
import {
	backupSnapshotRoot,
	bootstrapStatePath,
	composePath,
	connectionPath,
	enginesStateDir,
	healthPath,
	routingTablePath,
	upgradeBackupsPath,
	upgradeCheckpointPath,
	upgradeMetadataPath,
	versionPath,
} from "../state/paths";

const pathExists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

const resolveBackupDestination = (
	projectRoot: string,
	backupRoot: string,
	targetPath: string,
): string => {
	const relativePath =
		isAbsolute(targetPath) && targetPath.startsWith(projectRoot)
			? relative(projectRoot, targetPath)
			: basename(targetPath);
	return join(backupRoot, relativePath);
};

export const defaultBackupTargets = (
	projectRoot: string,
): Array<{ path: string; category: BackupArtifactCategory }> => [
	{ path: getConfigPath(projectRoot), category: "config" },
	{ path: versionPath(projectRoot), category: "runtime-metadata" },
	{ path: connectionPath(projectRoot), category: "runtime-metadata" },
	{ path: healthPath(projectRoot), category: "runtime-metadata" },
	{ path: composePath(projectRoot), category: "runtime-metadata" },
	{ path: routingTablePath(projectRoot), category: "routing" },
	{ path: bootstrapStatePath(projectRoot), category: "bootstrap" },
	{ path: enginesStateDir(projectRoot), category: "engine-state" },
	{ path: upgradeMetadataPath(projectRoot), category: "upgrade-metadata" },
	{ path: upgradeCheckpointPath(projectRoot), category: "upgrade-metadata" },
	{ path: upgradeBackupsPath(projectRoot), category: "upgrade-metadata" },
];

export const createBackupManifest = async (options: {
	projectRoot: string;
	upgradeId: string;
	targets?: Array<{ path: string; category: BackupArtifactCategory }>;
}): Promise<BackupManifest> => {
	const targets = options.targets ?? defaultBackupTargets(options.projectRoot);
	const backupRoot = backupSnapshotRoot(options.projectRoot, options.upgradeId);
	await mkdir(backupRoot, { recursive: true });

	const artifacts: BackupArtifact[] = [];
	for (const target of targets) {
		if (!(await pathExists(target.path))) {
			continue;
		}

		const backupPath = resolveBackupDestination(options.projectRoot, backupRoot, target.path);
		await mkdir(join(backupPath, ".."), { recursive: true });
		await cp(target.path, backupPath, { recursive: true, force: true });
		artifacts.push({
			path: target.path,
			backupPath,
			category: target.category,
			createdAt: new Date().toISOString(),
			restorable: true,
			restoredAt: null,
		});
	}

	const manifest: BackupManifest = {
		upgradeId: options.upgradeId,
		root: backupRoot,
		createdAt: new Date().toISOString(),
		artifacts,
	};

	await persistBackupManifest(options.projectRoot, manifest);
	return manifest;
};

export const restoreBackupArtifact = async (artifact: BackupArtifact): Promise<BackupArtifact> => {
	if (!artifact.restorable || !(await pathExists(artifact.backupPath))) {
		return artifact;
	}

	await mkdir(join(artifact.path, ".."), { recursive: true });
	await rm(artifact.path, { recursive: true, force: true });
	await cp(artifact.backupPath, artifact.path, { recursive: true, force: true });
	return {
		...artifact,
		restoredAt: new Date().toISOString(),
	};
};

export const restoreBackupManifest = async (options: {
	projectRoot: string;
	paths?: string[];
}): Promise<BackupArtifact[]> => {
	const manifest = await loadBackupManifest(options.projectRoot);
	if (!manifest) {
		return [];
	}

	const pathFilter = options.paths ? new Set(options.paths) : null;
	const restored: BackupArtifact[] = [];
	for (const artifact of manifest.artifacts) {
		if (pathFilter && !pathFilter.has(artifact.path)) {
			continue;
		}
		restored.push(await restoreBackupArtifact(artifact));
	}

	await persistBackupManifest(options.projectRoot, {
		...manifest,
		artifacts: manifest.artifacts.map((artifact) => {
			const restoredArtifact = restored.find((entry) => entry.path === artifact.path);
			return restoredArtifact ?? artifact;
		}),
	});

	return restored;
};
