import { join } from "node:path";

import { getMimirmeshDir } from "@mimirmesh/config";

export const runtimeRoot = (projectRoot: string): string =>
	join(getMimirmeshDir(projectRoot), "runtime");
export const backupsRoot = (projectRoot: string): string =>
	join(getMimirmeshDir(projectRoot), "backups");
export const quarantineRoot = (projectRoot: string): string =>
	join(runtimeRoot(projectRoot), "quarantine");

export const healthPath = (projectRoot: string): string =>
	join(runtimeRoot(projectRoot), "health.json");
export const connectionPath = (projectRoot: string): string =>
	join(runtimeRoot(projectRoot), "connection.json");
export const composePath = (projectRoot: string): string =>
	join(runtimeRoot(projectRoot), "docker-compose.yml");
export const versionPath = (projectRoot: string): string =>
	join(runtimeRoot(projectRoot), "version.json");
export const routingTablePath = (projectRoot: string): string =>
	join(runtimeRoot(projectRoot), "routing-table.json");
export const bootstrapStatePath = (projectRoot: string): string =>
	join(runtimeRoot(projectRoot), "bootstrap-state.json");
export const enginesStateDir = (projectRoot: string): string =>
	join(runtimeRoot(projectRoot), "engines");
export const engineStatePath = (projectRoot: string, engine: string): string =>
	join(enginesStateDir(projectRoot), `${engine}.json`);
export const mcpServerStatePath = (projectRoot: string): string =>
	join(runtimeRoot(projectRoot), "mcp-server.json");
export const upgradeMetadataPath = (projectRoot: string): string =>
	join(runtimeRoot(projectRoot), "upgrade-metadata.json");
export const upgradeCheckpointPath = (projectRoot: string): string =>
	join(runtimeRoot(projectRoot), "upgrade-checkpoint.json");
export const upgradeBackupsPath = (projectRoot: string): string =>
	join(runtimeRoot(projectRoot), "upgrade-backups.json");
export const backupSnapshotRoot = (projectRoot: string, timestamp: string): string =>
	join(backupsRoot(projectRoot), timestamp);
