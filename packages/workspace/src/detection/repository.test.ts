import { describe, expect, test } from "bun:test";

import { createFixtureCopy } from "@mimirmesh/testing";

import { analyzeRepository, searchInRepository } from "./repository";

describe("workspace analysis", () => {
  test("detects monorepo shape", async () => {
    const repo = await createFixtureCopy("bun-monorepo");
    const analysis = await analyzeRepository(repo);
    expect(analysis.shape).toBe("monorepo");
    expect(analysis.packageManagers.includes("bun")).toBe(true);
  });

  test("searches docs in docs-heavy fixture", async () => {
    const repo = await createFixtureCopy("docs-heavy");
    const hits = await searchInRepository(repo, "oncall", { docsOnly: true });
    expect(hits.length).toBeGreaterThan(0);
  });
});
