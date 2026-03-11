import { Database } from "bun:sqlite";
import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PreservedAssetRecord } from "@mimirmesh/config";
import { parse as parseYaml } from "yaml";

import {
	loadBootstrapState,
	loadConnection,
	loadHealth,
	loadRoutingTable,
	loadUpgradeMetadata,
	loadVersionRecord,
} from "../state/io";
import { quarantineAsset } from "./assets";

const pathExists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

const validateRuntimeMetadata = async (projectRoot: string): Promise<void> => {
	const [version, metadata, connection, health, bootstrap, routing] = await Promise.all([
		loadVersionRecord(projectRoot),
		loadUpgradeMetadata(projectRoot),
		loadConnection(projectRoot),
		loadHealth(projectRoot),
		loadBootstrapState(projectRoot),
		loadRoutingTable(projectRoot),
	]);
	if (!version || !metadata || !connection || !health || !bootstrap || !routing) {
		throw new Error("runtime metadata is incomplete");
	}
};

const validateMarkdownDirectory = async (directory: string): Promise<void> => {
	const entries = await readdir(directory);
	const markdownFiles = entries.filter((entry) => entry.endsWith(".md") || entry.endsWith(".mdx"));
	if (markdownFiles.length === 0) {
		throw new Error("no markdown files found");
	}

	for (const file of markdownFiles.slice(0, 3)) {
		const contents = await readFile(join(directory, file), "utf8");
		if (contents.trim().length === 0) {
			throw new Error(`markdown file ${file} is empty`);
		}
	}
};

const validateWritableDirectory = async (directory: string): Promise<void> => {
	await mkdir(directory, { recursive: true });
	const marker = join(directory, ".mimirmesh-upgrade-write-check");
	await writeFile(marker, "ok\n", "utf8");
	await rm(marker, { force: true });
};

const validateSqliteAsset = async (location: string): Promise<void> => {
	const candidates = location.endsWith(".db")
		? [location]
		: (await readdir(location))
				.filter((entry) => entry.endsWith(".db"))
				.map((entry) => join(location, entry));
	if (candidates.length === 0) {
		throw new Error("no sqlite database found");
	}

	for (const candidate of candidates.slice(0, 1)) {
		const database = new Database(candidate, { readonly: true, create: false });
		try {
			database.query("SELECT name FROM sqlite_master LIMIT 1").all();
		} finally {
			database.close();
		}
	}
};

const validateComposeRuntime = async (location: string): Promise<void> => {
	const contents = await readFile(location, "utf8");
	const parsed = parseYaml(contents) as { services?: unknown };
	if (!parsed || typeof parsed !== "object" || parsed.services == null) {
		throw new Error("compose file has no services definition");
	}
};

const validateAsset = async (projectRoot: string, asset: PreservedAssetRecord): Promise<void> => {
	if (!(await pathExists(asset.location))) {
		throw new Error(`${asset.location} is missing`);
	}

	switch (asset.assetType) {
		case "runtime-metadata":
			await validateRuntimeMetadata(projectRoot);
			return;
		case "reports":
			await validateMarkdownDirectory(asset.location);
			return;
		case "notes":
		case "memory":
			await validateWritableDirectory(asset.location);
			return;
		case "engine-index":
			await validateSqliteAsset(asset.location);
			return;
		case "engine-cache":
			await access(asset.location);
			return;
		case "engine-state":
			await access(asset.location);
			return;
		case "compose-runtime":
			await validateComposeRuntime(asset.location);
			return;
	}
};

export const validatePreservedAssets = async (options: {
	projectRoot: string;
	assets: PreservedAssetRecord[];
	quarantineInvalidAssets?: boolean;
}): Promise<{
	assets: PreservedAssetRecord[];
	quarantinedAssets: PreservedAssetRecord[];
	warnings: string[];
}> => {
	const validated: PreservedAssetRecord[] = [];
	const quarantinedAssets: PreservedAssetRecord[] = [];
	const warnings: string[] = [];

	for (const asset of options.assets) {
		try {
			await validateAsset(options.projectRoot, asset);
			validated.push({
				...asset,
				validationResult: "passed",
				repairRequired: false,
				lastValidatedAt: new Date().toISOString(),
			});
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			warnings.push(`${asset.assetType}: ${reason}`);
			if (options.quarantineInvalidAssets ?? true) {
				const quarantined = await quarantineAsset({
					projectRoot: options.projectRoot,
					asset,
					reason,
				});
				validated.push(quarantined);
				quarantinedAssets.push(quarantined);
			} else {
				validated.push({
					...asset,
					validationResult: "failed",
					repairRequired: true,
					details: `${asset.details} ${reason}`,
					lastValidatedAt: new Date().toISOString(),
				});
			}
		}
	}

	return {
		assets: validated,
		quarantinedAssets,
		warnings,
	};
};
