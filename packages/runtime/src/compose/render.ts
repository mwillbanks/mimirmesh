import { join, resolve } from "node:path";

import type { MimirmeshConfig } from "@mimirmesh/config";
import { type RuntimeAdapterContext, translateAllEngineConfigs } from "@mimirmesh/mcp-adapters";

import { engineCommand } from "../images/engine-images";

const yamlQuote = (value: string): string => {
	const escaped = value.replaceAll("'", "''");
	return `'${escaped}'`;
};

const envLines = (env: Record<string, string>): string[] => {
	return Object.entries(env)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => `      ${key}: ${yamlQuote(value)}`);
};

export const renderCompose = (
	projectRoot: string,
	config: MimirmeshConfig,
	options: { adapterContext?: RuntimeAdapterContext } = {},
): string => {
	const runtimeRoot = join(projectRoot, ".mimirmesh");
	const postgresData = join(runtimeRoot, "cache", "postgres");
	const repoMountHost = resolve(projectRoot);
	const mmMountHost = resolve(runtimeRoot);

	const translated = translateAllEngineConfigs(projectRoot, config, options.adapterContext);

	const services: string[] = [];

	services.push(`  mm-postgres:
    image: pgvector/pgvector:pg17
    restart: unless-stopped
    environment:
      POSTGRES_DB: mimirmesh
      POSTGRES_USER: mimirmesh
      POSTGRES_PASSWORD: mimirmesh
    volumes:
      - ${yamlQuote(`${postgresData}:/var/lib/postgresql/data`)}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mimirmesh"]
      interval: 10s
      timeout: 5s
      retries: 10`);

	for (const engine of translated) {
		const command = engineCommand(engine.contract.id, engine.contract);
		const dockerfile = resolve(projectRoot, engine.contract.dockerfile);
		const context = resolve(projectRoot, engine.contract.context);

		const env = {
			...engine.contract.env,
			MIMIRMESH_ENGINE_ID: engine.contract.id,
			MIMIRMESH_BRIDGE_PORT: String(engine.contract.bridgePort),
			MIMIRMESH_ENGINE_CMD: command.command,
			MIMIRMESH_ENGINE_ARGS: JSON.stringify(command.args),
			MIMIRMESH_ENGINE_TRANSPORT: command.transport,
			...(command.url ? { MIMIRMESH_ENGINE_URL: command.url } : {}),
			MIMIRMESH_PROJECT_ROOT: engine.contract.mounts.repo,
		};

		const dependsOn = "";
		const extraHosts =
			engine.contract.id === "document-mcp" || engine.contract.id === "srclight"
				? `
    extra_hosts:
      - "host.docker.internal:host-gateway"`
				: "";
		const gpuReservation =
			engine.contract.id === "srclight" &&
			options.adapterContext?.gpuResolutions?.srclight?.effectiveUseGpu
				? `
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              capabilities: [gpu]`
				: "";

		services.push(`  ${engine.contract.serviceName}:
    build:
      context: ${yamlQuote(context)}
      dockerfile: ${yamlQuote(dockerfile)}
    image: ${yamlQuote(engine.contract.imageTag)}
    restart: unless-stopped${dependsOn}${extraHosts}
    environment:
${envLines(env).join("\n")}
    volumes:
      - ${yamlQuote(`${repoMountHost}:${engine.contract.mounts.repo}`)}
      - ${yamlQuote(`${mmMountHost}:${engine.contract.mounts.mimirmesh}`)}
    ports:
      - target: ${engine.contract.bridgePort}
        published: 0
        protocol: tcp
        host_ip: 127.0.0.1${gpuReservation}
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:${engine.contract.bridgePort}/health"]
      interval: 10s
      timeout: 5s
      retries: 12`);
	}

	return `services:\n${services.join("\n\n")}\n`;
};
