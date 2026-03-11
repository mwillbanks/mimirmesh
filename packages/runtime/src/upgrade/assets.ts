import { access, cp, mkdir, readdir, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import type {
	PreservedAssetCompatibility,
	PreservedAssetRecord,
	ProjectRuntimeVersionRecord,
} from "@mimirmesh/config";

import { getMimirmeshDir } from "@mimirmesh/config";

import { quarantineRoot } from "../state/paths";
import { isAutomaticMigrationAllowed } from "./versioning";

const pathExists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

const compatibilityForRetainedState = (
	currentVersion: ProjectRuntimeVersionRecord | null,
): PreservedAssetCompatibility =>
	isAutomaticMigrationAllowed(currentVersion) ? "compatible" : "blocked";

export const collectPreservedAssets = async (
	projectRoot: string,
	currentVersion: ProjectRuntimeVersionRecord | null,
): Promise<PreservedAssetRecord[]> => {
	const mimirmeshRoot = getMimirmeshDir(projectRoot);
	const notesDir = join(mimirmeshRoot, "memory", "notes");
	const memoryDir = join(mimirmeshRoot, "memory");
	const reportsDir = join(mimirmeshRoot, "reports");
	const runtimeDir = join(mimirmeshRoot, "runtime");
	const indexesDir = join(mimirmeshRoot, "indexes");
	const srclightIndex = join(projectRoot, ".srclight", "index.db");
	const runtimeCompose = join(runtimeDir, "docker-compose.yml");
	const assets: PreservedAssetRecord[] = [];

	if (await pathExists(notesDir)) {
		assets.push({
			assetType: "notes",
			location: notesDir,
			compatibility: "compatible",
			validationMode: "live-check",
			validationResult: "skipped",
			repairRequired: false,
			details: "Preserve project notes in place.",
			quarantinePath: null,
			lastValidatedAt: null,
		});
	}

	if (await pathExists(memoryDir)) {
		assets.push({
			assetType: "memory",
			location: memoryDir,
			compatibility: "compatible",
			validationMode: "live-check",
			validationResult: "skipped",
			repairRequired: false,
			details: "Preserve project memory content in place.",
			quarantinePath: null,
			lastValidatedAt: null,
		});
	}

	if (await pathExists(reportsDir)) {
		assets.push({
			assetType: "reports",
			location: reportsDir,
			compatibility: "compatible",
			validationMode: "live-check",
			validationResult: "skipped",
			repairRequired: false,
			details: "Preserve generated reports unless validation fails.",
			quarantinePath: null,
			lastValidatedAt: null,
		});
	}

	if (await pathExists(runtimeDir)) {
		assets.push({
			assetType: "runtime-metadata",
			location: runtimeDir,
			compatibility: "compatible",
			validationMode: "metadata",
			validationResult: "skipped",
			repairRequired: false,
			details: "Runtime metadata remains authoritative after migration.",
			quarantinePath: null,
			lastValidatedAt: null,
		});
	}

	if (await pathExists(join(runtimeDir, "engines"))) {
		assets.push({
			assetType: "engine-state",
			location: join(runtimeDir, "engines"),
			compatibility: "compatible",
			validationMode: "metadata",
			validationResult: "skipped",
			repairRequired: false,
			details: "Persisted engine runtime state remains available for reconciliation.",
			quarantinePath: null,
			lastValidatedAt: null,
		});
	}

	if (await pathExists(indexesDir)) {
		const compatibility = compatibilityForRetainedState(currentVersion);
		const entries = await readdir(indexesDir);
		assets.push({
			assetType: entries.some((entry) => entry.endsWith(".db")) ? "engine-index" : "engine-cache",
			location: indexesDir,
			compatibility,
			validationMode: entries.some((entry) => entry.endsWith(".db")) ? "live-check" : "presence",
			validationResult: "skipped",
			repairRequired: compatibility !== "compatible",
			details:
				compatibility === "compatible"
					? "Preserve compatible engine indexes and caches."
					: "Engine indexes require manual intervention outside the automatic compatibility window.",
			quarantinePath: null,
			lastValidatedAt: null,
		});
	}

	if (await pathExists(srclightIndex)) {
		assets.push({
			assetType: "engine-index",
			location: srclightIndex,
			compatibility: compatibilityForRetainedState(currentVersion),
			validationMode: "live-check",
			validationResult: "skipped",
			repairRequired: false,
			details: "Preserve the repo-local Srclight index when it remains readable.",
			quarantinePath: null,
			lastValidatedAt: null,
		});
	}

	if (await pathExists(runtimeCompose)) {
		assets.push({
			assetType: "compose-runtime",
			location: runtimeCompose,
			compatibility: "compatible",
			validationMode: "metadata",
			validationResult: "skipped",
			repairRequired: false,
			details: "Generated compose runtime definitions must remain renderable.",
			quarantinePath: null,
			lastValidatedAt: null,
		});
	}

	return assets;
};

const moveWithFallback = async (fromPath: string, toPath: string): Promise<void> => {
	try {
		await rename(fromPath, toPath);
	} catch {
		await cp(fromPath, toPath, { recursive: true, force: true });
		await rm(fromPath, { recursive: true, force: true });
	}
};

export const quarantineAsset = async (options: {
	projectRoot: string;
	asset: PreservedAssetRecord;
	reason: string;
}): Promise<PreservedAssetRecord> => {
	if (!(await pathExists(options.asset.location))) {
		return {
			...options.asset,
			validationResult: "quarantined",
			repairRequired: true,
			details: `${options.asset.details} ${options.reason}`,
			quarantinePath: null,
			lastValidatedAt: new Date().toISOString(),
		};
	}

	const destination = join(
		quarantineRoot(options.projectRoot),
		new Date().toISOString().replaceAll(":", "-"),
		basename(options.asset.location),
	);
	await mkdir(dirname(destination), { recursive: true });
	await moveWithFallback(options.asset.location, destination);

	return {
		...options.asset,
		validationResult: "quarantined",
		repairRequired: true,
		details: `${options.asset.details} ${options.reason}`,
		quarantinePath: destination,
		lastValidatedAt: new Date().toISOString(),
	};
};

export const restoreQuarantinedAsset = async (
	asset: PreservedAssetRecord,
): Promise<PreservedAssetRecord> => {
	if (!asset.quarantinePath || !(await pathExists(asset.quarantinePath))) {
		return asset;
	}

	await mkdir(dirname(asset.location), { recursive: true });
	await moveWithFallback(asset.quarantinePath, asset.location);
	return {
		...asset,
		validationResult: "skipped",
		repairRequired: false,
		quarantinePath: null,
		lastValidatedAt: new Date().toISOString(),
	};
};
