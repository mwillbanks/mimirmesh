import { describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { createDefaultConfig } from "@mimirmesh/config";

import { translateDocumentMcpConfig } from "./config";
import type { DocumentMcpSettings } from "./types";

describe("document-mcp config translation", () => {
  test("targets docs directories instead of the repo root when docs exist and uses upstream defaults", async () => {
    const projectRoot = "/tmp/document-mcp";
    await mkdir(join(projectRoot, "docs"), { recursive: true });
    const config = createDefaultConfig(projectRoot);
    const settings = config.engines["document-mcp"].settings as DocumentMcpSettings;
    settings.watchFolders = ["/workspace"];
    const translated = translateDocumentMcpConfig(projectRoot, config);

    expect(translated.contract.env.WATCH_FOLDERS).toBe("/workspace/docs");
    expect((translated.contract.env.LANCEDB_PATH ?? "").includes("/mimirmesh/indexes")).toBe(true);
    expect(translated.contract.env.LLM_MODEL).toBe("llama3.2:3b");
    expect(translated.contract.env.EMBEDDING_MODEL).toBe("all-MiniLM-L6-v2");
    expect(translated.contract.env.OLLAMA_BASE_URL).toBe("http://host.docker.internal:11434");
    expect(translated.contract.env.BATCH_SIZE).toBe("10");
  });

  test("fills missing settings from defaults instead of crashing on legacy config", async () => {
    const projectRoot = "/tmp/document-mcp-legacy";
    await mkdir(join(projectRoot, "docs"), { recursive: true });
    const config = createDefaultConfig(projectRoot);
    config.engines["document-mcp"].settings = {} as DocumentMcpSettings;

    const translated = translateDocumentMcpConfig(projectRoot, config);

    expect(translated.errors).toHaveLength(0);
    expect(translated.contract.env.WATCH_FOLDERS).toBe("/workspace/docs");
    expect(translated.contract.env.LLM_MODEL).toBe("llama3.2:3b");
  });
});
