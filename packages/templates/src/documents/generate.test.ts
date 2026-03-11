import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createDefaultConfig } from "@mimirmesh/config";
import { createFixtureCopy } from "@mimirmesh/testing";

import { generateDocument, recommendedDocumentPath } from "./generate";

describe("templates", () => {
  test("generates document with defaults", async () => {
    const repo = await createFixtureCopy("single-ts");
    const config = createDefaultConfig(repo);

    const output = await generateDocument(repo, config, {
      family: "feature",
      title: "Feature Alpha",
      context: {
        problem: "Need a feature",
        behavior: "It should work",
        acceptanceCriteria: "Given/When/Then",
      },
    });

    const content = await Bun.file(output.path).text();
    expect(content.includes("# Feature Alpha")).toBe(true);
  });

  test("uses local override when present", async () => {
    const repo = await createFixtureCopy("single-ts");
    const config = createDefaultConfig(repo);
    await mkdir(config.templates.overrideDir, { recursive: true });
    await writeFile(
      join(config.templates.overrideDir, config.templates.families.runbook),
      "# {{title}}\n\nOverride: {{steps}}\n",
      "utf8",
    );

    const output = await generateDocument(repo, config, {
      family: "runbook",
      title: "Runbook One",
      context: {
        steps: "Step A",
      },
    });

    const content = await Bun.file(output.path).text();
    expect(content.includes("Override: Step A")).toBe(true);
  });

  test("writes decision notes into docs/adr", async () => {
    const repo = await createFixtureCopy("single-ts");

    const path = recommendedDocumentPath(repo, "decisionNote", "Adopt Local ADRs");

    expect(path.endsWith("/docs/adr/adopt-local-adrs.md")).toBe(true);
  });
});
