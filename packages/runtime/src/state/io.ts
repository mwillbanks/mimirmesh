import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
	type BackupManifest,
	backupManifestSchema,
	type ProjectRuntimeVersionRecord,
	projectRuntimeVersionRecordSchema,
	type RuntimeUpgradeMetadata,
	runtimeUpgradeMetadataSchema,
	type UpgradeCheckpoint,
	upgradeCheckpointSchema,
} from "@mimirmesh/config";
import type { ZodType } from "zod";

import type {
	BootstrapStateFile,
	EngineRuntimeState,
	RoutingTable,
	RuntimeConnection,
	RuntimeHealth,
} from "../types";
import {
	bootstrapStatePath,
	composePath,
	connectionPath,
	engineStatePath,
	enginesStateDir,
	healthPath,
	mcpServerStatePath,
	routingTablePath,
	skillRegistryStatePath,
	upgradeBackupsPath,
	upgradeCheckpointPath,
	upgradeMetadataPath,
	versionPath,
} from "./paths";

export const writeJson = async (path: string, value: unknown): Promise<void> => {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const readJsonParsed = async (path: string): Promise<unknown | null> => {
	try {
		const raw = await readFile(path, "utf8");
		return JSON.parse(raw) as unknown;
	} catch {
		return null;
	}
};

const readJsonWithSchema = async <T>(path: string, schema: ZodType<T>): Promise<T | null> => {
	const parsed = await readJsonParsed(path);
	if (parsed === null) {
		return null;
	}
	const validated = schema.safeParse(parsed);
	return validated.success ? validated.data : null;
};

export const readJsonSafe = async <T>(path: string, fallback: T): Promise<T> => {
	const parsed = await readJsonParsed(path);
	return (parsed as T | null) ?? fallback;
};

export const writeComposeFile = async (projectRoot: string, content: string): Promise<void> => {
	await mkdir(dirname(composePath(projectRoot)), { recursive: true });
	await writeFile(composePath(projectRoot), content, "utf8");
};

export const persistHealth = async (projectRoot: string, health: RuntimeHealth): Promise<void> => {
	await writeJson(healthPath(projectRoot), health);
};

export const persistConnection = async (
	projectRoot: string,
	connection: RuntimeConnection,
): Promise<void> => {
	await writeJson(connectionPath(projectRoot), connection);
};

export const persistRoutingTable = async (
	projectRoot: string,
	routingTable: RoutingTable,
): Promise<void> => {
	await writeJson(routingTablePath(projectRoot), routingTable);
};

export const persistBootstrapState = async (
	projectRoot: string,
	state: BootstrapStateFile,
): Promise<void> => {
	await writeJson(bootstrapStatePath(projectRoot), state);
};

export const persistEngineState = async (
	projectRoot: string,
	state: EngineRuntimeState,
): Promise<void> => {
	await mkdir(enginesStateDir(projectRoot), { recursive: true });
	await writeJson(engineStatePath(projectRoot, state.engine), state);
};

export const loadHealth = async (projectRoot: string): Promise<RuntimeHealth | null> =>
	readJsonSafe<RuntimeHealth | null>(healthPath(projectRoot), null);

export const loadConnection = async (projectRoot: string): Promise<RuntimeConnection | null> =>
	readJsonSafe<RuntimeConnection | null>(connectionPath(projectRoot), null);

export const loadRoutingTable = async (projectRoot: string): Promise<RoutingTable | null> =>
	readJsonSafe<RoutingTable | null>(routingTablePath(projectRoot), null);

export const loadBootstrapState = async (projectRoot: string): Promise<BootstrapStateFile | null> =>
	readJsonSafe<BootstrapStateFile | null>(bootstrapStatePath(projectRoot), null);

export const loadEngineState = async (
	projectRoot: string,
	engine: string,
): Promise<EngineRuntimeState | null> =>
	readJsonSafe<EngineRuntimeState | null>(engineStatePath(projectRoot, engine), null);

export const persistVersionRecord = async (
	projectRoot: string,
	record: ProjectRuntimeVersionRecord,
): Promise<void> => {
	await writeJson(versionPath(projectRoot), record);
};

export const loadVersionRecord = async (
	projectRoot: string,
): Promise<ProjectRuntimeVersionRecord | null> =>
	readJsonWithSchema<ProjectRuntimeVersionRecord>(
		versionPath(projectRoot),
		projectRuntimeVersionRecordSchema,
	);

export const persistUpgradeMetadata = async (
	projectRoot: string,
	metadata: RuntimeUpgradeMetadata,
): Promise<void> => {
	await writeJson(upgradeMetadataPath(projectRoot), metadata);
};

export const loadUpgradeMetadata = async (
	projectRoot: string,
): Promise<RuntimeUpgradeMetadata | null> =>
	readJsonWithSchema<RuntimeUpgradeMetadata>(
		upgradeMetadataPath(projectRoot),
		runtimeUpgradeMetadataSchema,
	);

export const persistUpgradeCheckpoint = async (
	projectRoot: string,
	checkpoint: UpgradeCheckpoint,
): Promise<void> => {
	await writeJson(upgradeCheckpointPath(projectRoot), checkpoint);
};

export const loadUpgradeCheckpoint = async (
	projectRoot: string,
): Promise<UpgradeCheckpoint | null> =>
	readJsonWithSchema<UpgradeCheckpoint>(
		upgradeCheckpointPath(projectRoot),
		upgradeCheckpointSchema,
	);

export const persistBackupManifest = async (
	projectRoot: string,
	manifest: BackupManifest,
): Promise<void> => {
	await writeJson(upgradeBackupsPath(projectRoot), manifest);
};

export const loadBackupManifest = async (projectRoot: string): Promise<BackupManifest | null> =>
	readJsonWithSchema<BackupManifest>(upgradeBackupsPath(projectRoot), backupManifestSchema);

export const collectSrclightRepoLocalEvidence = async (
	projectRoot: string,
): Promise<{
	repoLocalStateDir: string;
	repoLocalIndexPresent: boolean;
	repoLocalEmbeddingFiles: string[];
}> => {
	const repoLocalStateDir = join(projectRoot, ".srclight");
	const trackedEmbeddingFiles = ["embeddings.npy", "embeddings_norms.npy", "embeddings_meta.json"];

	const fileExists = async (path: string): Promise<boolean> => {
		try {
			await access(path);
			return true;
		} catch {
			return false;
		}
	};

	const repoLocalIndexPresent = await fileExists(join(repoLocalStateDir, "index.db"));
	const repoLocalEmbeddingFiles = (
		await Promise.all(
			trackedEmbeddingFiles.map(async (fileName) =>
				(await fileExists(join(repoLocalStateDir, fileName))) ? fileName : null,
			),
		)
	).filter((value): value is string => value !== null);

	return {
		repoLocalStateDir,
		repoLocalIndexPresent,
		repoLocalEmbeddingFiles,
	};
};

export const hashValue = (value: unknown): string =>
	createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const hashString = (value: string): string =>
	createHash("sha256").update(value).digest("hex");

export const runtimeFiles = (projectRoot: string): string[] => [
	composePath(projectRoot),
	connectionPath(projectRoot),
	healthPath(projectRoot),
	versionPath(projectRoot),
	routingTablePath(projectRoot),
	bootstrapStatePath(projectRoot),
	mcpServerStatePath(projectRoot),
	join(enginesStateDir(projectRoot), "srclight.json"),
	join(enginesStateDir(projectRoot), "document-mcp.json"),
	join(enginesStateDir(projectRoot), "mcp-adr-analysis-server.json"),
	skillRegistryStatePath(projectRoot),
	upgradeMetadataPath(projectRoot),
	upgradeCheckpointPath(projectRoot),
	upgradeBackupsPath(projectRoot),
];
