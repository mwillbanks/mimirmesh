import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { createDefaultConfig, type MimirmeshConfig } from "@mimirmesh/config";
import {
	composeDown,
	detectDockerAvailability,
	openSkillRegistryDatabase,
	runCompose,
} from "@mimirmesh/runtime";
import { shouldRunIntegrationTests } from "@mimirmesh/testing";

let runtimeBootstrapQueue = Promise.resolve();
const runtimeBootstrapLockDirectory = join(tmpdir(), "mimirmesh-skill-runtime.lock");
const runtimeBootstrapLockOwnerFile = join(runtimeBootstrapLockDirectory, "owner.json");
const sharedRuntimeRoot = join(tmpdir(), "mimirmesh-skill-runtime-shared");
const sharedRuntimeComposeFile = join(sharedRuntimeRoot, "docker-compose.yml");
const sharedRuntimeStateFile = join(sharedRuntimeRoot, "state.json");
const runtimeBootstrapLockPollMs = 250;
const runtimeBootstrapLockStaleMs = 10 * 60 * 1000;
const sharedRuntimeReuseWindowMs = 30 * 60 * 1000;

type RuntimeLockState = {
	pid: number;
	acquiredAt?: string;
	stage: string;
	projectName?: string;
	composeFile?: string;
	attempt?: number;
};

type SharedRuntimeState = {
	root: string;
	composeFile: string;
	projectName: string;
	lastUsedAt: string;
	startedAt: string;
};

const processExists = (pid: number): boolean => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};

const writeRuntimeLockState = async (state: RuntimeLockState): Promise<void> => {
	await writeFile(runtimeBootstrapLockOwnerFile, JSON.stringify(state), "utf8");
};

const loadSharedRuntimeState = async (): Promise<SharedRuntimeState | null> => {
	try {
		return JSON.parse(await readFile(sharedRuntimeStateFile, "utf8")) as SharedRuntimeState;
	} catch {
		return null;
	}
};

const saveSharedRuntimeState = async (state: SharedRuntimeState): Promise<void> => {
	await mkdir(state.root, { recursive: true });
	await writeFile(sharedRuntimeStateFile, JSON.stringify(state), "utf8");
};

const removeSharedRuntimeState = async (): Promise<void> => {
	await rm(sharedRuntimeStateFile, { force: true });
};

const applySharedRuntimeState = (config: MimirmeshConfig, state: SharedRuntimeState): void => {
	config.runtime.composeFile = state.composeFile;
	config.runtime.projectName = state.projectName;
};

const createSharedRuntimeState = async (): Promise<SharedRuntimeState> => {
	await mkdir(sharedRuntimeRoot, { recursive: true });
	await writeFile(
		sharedRuntimeComposeFile,
		`services:
  mm-postgres:
    image: pgvector/pgvector:pg17
    restart: unless-stopped
    environment:
      POSTGRES_DB: mimirmesh
      POSTGRES_USER: mimirmesh
      POSTGRES_PASSWORD: mimirmesh
    ports:
      - target: 5432
        published: 0
        protocol: tcp
        host_ip: 127.0.0.1
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mimirmesh"]
      interval: 5s
      timeout: 5s
      retries: 20
`,
		"utf8",
	);
	const now = new Date().toISOString();
	return {
		root: sharedRuntimeRoot,
		composeFile: sharedRuntimeComposeFile,
		projectName: "mimirmesh-skill-runtime",
		lastUsedAt: now,
		startedAt: now,
	};
};

const stopSharedRuntime = async (
	config: MimirmeshConfig,
	state: SharedRuntimeState | null,
): Promise<void> => {
	if (!state) {
		return;
	}
	applySharedRuntimeState(config, state);
	await composeDown(config);
	await removeSharedRuntimeState();
	await rm(state.root, { recursive: true, force: true });
};

export const cleanupSharedSkillRegistryRuntime = async (): Promise<void> => {
	const releaseBootstrapLock = await acquireRuntimeBootstrapLock();
	try {
		const state = await loadSharedRuntimeState();
		if (!state) {
			return;
		}
		const config = createDefaultConfig(state.root);
		await stopSharedRuntime(config, state);
	} finally {
		await releaseBootstrapLock();
	}
};

const acquireCrossProcessRuntimeLock = async (): Promise<() => Promise<void>> => {
	const startedAt = Date.now();

	while (true) {
		try {
			await mkdir(runtimeBootstrapLockDirectory);
			await writeRuntimeLockState({
				pid: process.pid,
				acquiredAt: new Date().toISOString(),
				stage: "lock-acquired",
			});
			return async () => {
				await rm(runtimeBootstrapLockDirectory, { recursive: true, force: true });
			};
		} catch (error) {
			if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") {
				throw error;
			}

			try {
				const ownerRaw = await Bun.file(runtimeBootstrapLockOwnerFile).text();
				const owner = JSON.parse(ownerRaw) as { pid?: number };
				if (typeof owner.pid === "number" && !processExists(owner.pid)) {
					await rm(runtimeBootstrapLockDirectory, { recursive: true, force: true });
					continue;
				}
			} catch {
				await rm(runtimeBootstrapLockDirectory, { recursive: true, force: true });
				continue;
			}

			try {
				const lockStats = await stat(runtimeBootstrapLockDirectory);
				if (Date.now() - lockStats.mtimeMs > runtimeBootstrapLockStaleMs) {
					await rm(runtimeBootstrapLockDirectory, { recursive: true, force: true });
					continue;
				}
			} catch {
				continue;
			}

			if (Date.now() - startedAt > runtimeBootstrapLockStaleMs) {
				throw new Error("Timed out waiting to acquire the skill runtime test lock.");
			}

			await delay(runtimeBootstrapLockPollMs);
		}
	}
};

const acquireRuntimeBootstrapLock = async (): Promise<() => Promise<void>> => {
	let releaseLock = () => {};
	const previous = runtimeBootstrapQueue;
	runtimeBootstrapQueue = new Promise<void>((resolve) => {
		releaseLock = resolve;
	});
	await previous;
	const releaseCrossProcessLock = await acquireCrossProcessRuntimeLock();

	let released = false;
	return async () => {
		if (released) {
			return;
		}
		released = true;
		await releaseCrossProcessLock().finally(() => {
			releaseLock();
		});
	};
};

export const startSkillRegistryRuntime = async (
	_projectRoot: string,
	config: MimirmeshConfig,
): Promise<{ available: boolean; stop: () => Promise<void> }> => {
	const releaseBootstrapLock = await acquireRuntimeBootstrapLock();
	try {
		if (!shouldRunIntegrationTests(process.env)) {
			await writeRuntimeLockState({ pid: process.pid, stage: "integration-disabled" });
			await releaseBootstrapLock();
			return {
				available: false,
				stop: async () => {},
			};
		}

		const docker = await detectDockerAvailability();
		if (!docker.dockerInstalled || !docker.dockerDaemonRunning || !docker.composeAvailable) {
			await writeRuntimeLockState({ pid: process.pid, stage: "docker-unavailable" });
			await releaseBootstrapLock();
			return {
				available: false,
				stop: async () => {},
			};
		}

		const existingState = await loadSharedRuntimeState();
		if (existingState) {
			const stateAgeMs = Date.now() - Date.parse(existingState.lastUsedAt);
			applySharedRuntimeState(config, existingState);
			const existingDatabase = await openSkillRegistryDatabase(config);
			if (existingDatabase && stateAgeMs <= sharedRuntimeReuseWindowMs) {
				await existingDatabase.sql.close();
				await saveSharedRuntimeState({
					...existingState,
					lastUsedAt: new Date().toISOString(),
				});
				await releaseBootstrapLock();
				return {
					available: true,
					stop: async () => {
						const releaseStopLock = await acquireRuntimeBootstrapLock();
						try {
							const state = await loadSharedRuntimeState();
							if (state) {
								await saveSharedRuntimeState({
									...state,
									lastUsedAt: new Date().toISOString(),
								});
							}
						} finally {
							await releaseStopLock();
						}
					},
				};
			}
			await existingDatabase?.sql.close();
			await stopSharedRuntime(config, existingState);
		}

		const sharedState = await createSharedRuntimeState();
		applySharedRuntimeState(config, sharedState);
		await writeRuntimeLockState({
			pid: process.pid,
			stage: "compose-up",
			projectName: sharedState.projectName,
			composeFile: sharedState.composeFile,
		});

		const started = await runCompose(config, ["up", "-d", "mm-postgres"]);
		if (started.exitCode !== 0) {
			await writeRuntimeLockState({
				pid: process.pid,
				stage: "compose-up-failed",
				projectName: sharedState.projectName,
				composeFile: sharedState.composeFile,
			});
			await removeSharedRuntimeState();
			await releaseBootstrapLock();
			throw new Error(
				started.stderr.trim() || started.stdout.trim() || "Failed to start mm-postgres",
			);
		}

		for (let attempt = 0; attempt < 120; attempt += 1) {
			if (attempt === 0 || attempt % 10 === 0) {
				await writeRuntimeLockState({
					pid: process.pid,
					stage: "waiting-for-database",
					projectName: sharedState.projectName,
					composeFile: sharedState.composeFile,
					attempt,
				});
			}
			const database = await openSkillRegistryDatabase(config);
			if (database) {
				await database.sql.close();
				await saveSharedRuntimeState({
					...sharedState,
					lastUsedAt: new Date().toISOString(),
				});
				await writeRuntimeLockState({
					pid: process.pid,
					stage: "database-ready",
					projectName: sharedState.projectName,
					composeFile: sharedState.composeFile,
				});
				await releaseBootstrapLock();
				return {
					available: true,
					stop: async () => {
						const releaseStopLock = await acquireRuntimeBootstrapLock();
						try {
							const state = await loadSharedRuntimeState();
							if (state) {
								await saveSharedRuntimeState({
									...state,
									lastUsedAt: new Date().toISOString(),
								});
							}
						} finally {
							await releaseStopLock();
						}
					},
				};
			}
			await delay(500);
		}

		await writeRuntimeLockState({
			pid: process.pid,
			stage: "database-timeout",
			projectName: sharedState.projectName,
			composeFile: sharedState.composeFile,
		});
		await stopSharedRuntime(config, sharedState);
		await releaseBootstrapLock();
		throw new Error("Timed out waiting for mm-postgres to accept skill-registry connections.");
	} catch (error) {
		await releaseBootstrapLock();
		throw error;
	}
};
