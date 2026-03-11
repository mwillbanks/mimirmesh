import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { MimirmeshConfig } from "@mimirmesh/config";

import type { EngineConfigTranslationResult } from "../../src/types";
import type { AdrSettings } from "./types";

const directoryHasAdrFiles = (directory: string): boolean => {
  if (!existsSync(directory)) {
    return false;
  }

  return readdirSync(directory).some((entry) => entry.endsWith(".md") || entry.endsWith(".mdx"));
};

export const resolveAdrDirectory = (projectRoot: string, settings: AdrSettings): string => {
  if (
    settings.adrDirectory &&
    settings.adrDirectory !== "docs/adr" &&
    settings.adrDirectory !== "docs/adrs"
  ) {
    return settings.adrDirectory;
  }

  const candidates = [
    "docs/adr",
    "docs/decisions",
    "docs/adrs",
    "adr",
    "decisions",
    "adrs",
  ];

  for (const candidate of candidates) {
    if (directoryHasAdrFiles(join(projectRoot, candidate))) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    if (existsSync(join(projectRoot, candidate))) {
      return candidate;
    }
  }

  return settings.adrDirectory;
};

export const translateAdrConfig = (
  projectRoot: string,
  config: MimirmeshConfig,
): EngineConfigTranslationResult => {
  const engine = config.engines["mcp-adr-analysis-server"];
  const settings = engine.settings as AdrSettings;
  const adrDirectory = resolveAdrDirectory(projectRoot, settings);
  const errors: string[] = [];

  if (!settings.projectPath.trim()) {
    errors.push("mcp-adr-analysis-server.settings.projectPath is required");
  }
  if (!adrDirectory.trim()) {
    errors.push("mcp-adr-analysis-server.settings.adrDirectory is required");
  }

  const degraded = settings.executionMode === "full" && !settings.openrouterApiKey;
  const degradedReason = degraded
    ? "OPENROUTER_API_KEY missing; running prompt-only mode"
    : errors.length > 0
      ? errors.join("; ")
      : undefined;

  return {
    contract: {
      id: "mcp-adr-analysis-server",
      namespace: engine.namespace,
      serviceName: engine.serviceName,
      required: engine.required,
      dockerfile: engine.image.dockerfile,
      context: engine.image.context,
      imageTag: engine.image.tag,
      bridgePort: engine.bridge.containerPort,
      bridgeTransport: "stdio",
      mounts: {
        repo: engine.mounts.repo,
        mimirmesh: engine.mounts.mimirmesh,
      },
      env: {
        PROJECT_PATH: settings.projectPath,
        ADR_DIRECTORY: adrDirectory,
        EXECUTION_MODE: settings.openrouterApiKey ? settings.executionMode : "prompt-only",
        OPENROUTER_API_KEY: settings.openrouterApiKey ?? "",
      },
    },
    errors,
    degraded: degraded || errors.length > 0,
    degradedReason,
  };
};
