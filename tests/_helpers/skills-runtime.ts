import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import type { MimirmeshConfig } from "@mimirmesh/config";
import {
	composeDown,
	detectDockerAvailability,
	openSkillRegistryDatabase,
	runCompose,
} from "@mimirmesh/runtime";

const createTestComposeFile = async (): Promise<{ composeFile: string; root: string }> => {
	const root = await mkdtemp(join(tmpdir(), "mimirmesh-skill-postgres-"));
	const composeFile = join(root, "docker-compose.yml");
	await writeFile(
		composeFile,
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
	return { composeFile, root };
};

export const startSkillRegistryRuntime = async (
	_projectRoot: string,
	config: MimirmeshConfig,
): Promise<{ available: boolean; stop: () => Promise<void> }> => {
	const docker = await detectDockerAvailability();
	if (!docker.dockerInstalled || !docker.dockerDaemonRunning || !docker.composeAvailable) {
		return {
			available: false,
			stop: async () => {},
		};
	}

	const sandbox = await createTestComposeFile();
	config.runtime.composeFile = sandbox.composeFile;
	config.runtime.projectName = `mimirmesh-skills-${Date.now().toString(36)}`;

	const started = await runCompose(config, ["up", "-d", "mm-postgres"]);
	if (started.exitCode !== 0) {
		await rm(sandbox.root, { recursive: true, force: true });
		throw new Error(
			started.stderr.trim() || started.stdout.trim() || "Failed to start mm-postgres",
		);
	}

	for (let attempt = 0; attempt < 40; attempt += 1) {
		const database = await openSkillRegistryDatabase(config);
		if (database) {
			await database.sql.close();
			return {
				available: true,
				stop: async () => {
					await composeDown(config);
					await rm(sandbox.root, { recursive: true, force: true });
				},
			};
		}
		await delay(500);
	}

	await composeDown(config);
	await rm(sandbox.root, { recursive: true, force: true });
	throw new Error("Timed out waiting for mm-postgres to accept skill-registry connections.");
};
