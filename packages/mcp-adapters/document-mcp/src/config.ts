import { existsSync } from "node:fs";
import { join } from "node:path";

import { createDefaultConfig, type MimirmeshConfig } from "@mimirmesh/config";

import type { EngineConfigTranslationResult } from "../../src/types";
import type { DocumentMcpSettings } from "./types";

const readSettings = (
  projectRoot: string,
  config: MimirmeshConfig,
): DocumentMcpSettings => {
  const defaults = createDefaultConfig(projectRoot).engines["document-mcp"]
    .settings as DocumentMcpSettings;
  const rawSettings = config.engines["document-mcp"].settings;
  const settings =
    rawSettings && typeof rawSettings === "object"
      ? Object.fromEntries(
          Object.entries(rawSettings).filter(([, value]) => value !== undefined),
        )
      : {};

  return {
    ...defaults,
    ...settings,
  } as DocumentMcpSettings;
};

const resolveDocumentPaths = (
  projectRoot: string,
  repoMount: string,
  settings: DocumentMcpSettings,
): {
  watchFolders: string[];
} => {
  const isLegacyRootConfig = settings.watchFolders.length === 1 && settings.watchFolders[0] === repoMount;

  if (!isLegacyRootConfig) {
    return {
      watchFolders: settings.watchFolders,
    };
  }

  if (existsSync(join(projectRoot, "docs"))) {
    return {
      watchFolders: [`${repoMount}/docs`],
    };
  }

  return {
    watchFolders: settings.watchFolders,
  };
};

export const translateDocumentMcpConfig = (
  projectRoot: string,
  config: MimirmeshConfig,
): EngineConfigTranslationResult => {
  const engine = config.engines["document-mcp"];
  const settings = readSettings(projectRoot, config);
  const resolved = resolveDocumentPaths(projectRoot, engine.mounts.repo, settings);

  const errors: string[] = [];
  if (resolved.watchFolders.length === 0) {
    errors.push("document-mcp.settings.watchFolders must include at least one path");
  }
  if (!settings.lancedbPath.trim()) {
    errors.push("document-mcp.settings.lancedbPath is required");
  }
  if (!settings.llmModel.trim()) {
    errors.push("document-mcp.settings.llmModel is required");
  }
  if (!settings.embeddingModel.trim()) {
    errors.push("document-mcp.settings.embeddingModel is required");
  }

  const degraded = errors.length > 0;

  return {
    contract: {
      id: "document-mcp",
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
        WATCH_FOLDERS: resolved.watchFolders.join(","),
        LANCEDB_PATH: settings.lancedbPath,
        LLM_MODEL: settings.llmModel,
        EMBEDDING_MODEL: settings.embeddingModel,
        FILE_EXTENSIONS: settings.fileExtensions.join(","),
        CHUNK_SIZE: String(settings.chunkSize),
        CHUNK_OVERLAP: String(settings.chunkOverlap),
        MAX_FILE_SIZE_MB: String(settings.maxFileSizeMb),
        OLLAMA_BASE_URL: settings.ollamaBaseUrl,
        BATCH_SIZE: String(settings.batchSize),
      },
    },
    errors,
    degraded,
    degradedReason: degraded ? errors.join("; ") : undefined,
  };
};
