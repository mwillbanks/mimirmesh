import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";

import { createDefaultConfig } from "@mimirmesh/config";
import { createFixtureCopy } from "@mimirmesh/testing";

import { generateRuntimeFiles } from "../compose/generate";
import {
  loadBootstrapState,
  loadConnection,
  loadEngineState,
  loadRoutingTable,
  runtimeFiles,
} from "./io";

describe("runtime state persistence", () => {
  test("writes required runtime metadata files", async () => {
    const repo = await createFixtureCopy("single-ts");
    try {
      const config = createDefaultConfig(repo);

      await generateRuntimeFiles(repo, config);

      const files = runtimeFiles(repo);
      for (const file of files) {
        expect(await Bun.file(file).exists()).toBe(true);
      }

      const connection = await loadConnection(repo);
      const routing = await loadRoutingTable(repo);
      const bootstrap = await loadBootstrapState(repo);
      const codebase = await loadEngineState(repo, "codebase-memory-mcp");

      expect(connection?.composeFile.endsWith("docker-compose.yml")).toBe(true);
      expect(Array.isArray(routing?.passthrough)).toBe(true);
      expect(Array.isArray(bootstrap?.engines)).toBe(true);
      expect(codebase?.engine).toBe("codebase-memory-mcp");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });
});
