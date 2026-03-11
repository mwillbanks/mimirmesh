import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createDefaultConfig } from "@mimirmesh/config";

import { prepareAdrToolInput } from "./routing";

describe("adr-analysis passthrough input preparation", () => {
  test("injects repo-aware adrDirectory and projectPath when the tool schema supports them", async () => {
    const projectRoot = "/tmp/adr-routing";
    await mkdir(join(projectRoot, "docs", "adr"), { recursive: true });
    await writeFile(join(projectRoot, "docs", "adr", "0001-test.md"), "# ADR\n");

    const config = createDefaultConfig(projectRoot);
    const prepared = prepareAdrToolInput(
      {},
      {
        projectRoot,
        config,
        inputSchema: {
          properties: {
            adrDirectory: { type: "string" },
            projectPath: { type: "string" },
          },
        },
      },
    );

    expect(prepared.adrDirectory).toBe("docs/adr");
    expect(prepared.projectPath).toBe("/workspace");
  });
});
