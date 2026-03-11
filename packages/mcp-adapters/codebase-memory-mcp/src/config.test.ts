import { describe, expect, test } from "bun:test";

import { createDefaultConfig } from "@mimirmesh/config";

import { translateCodebaseMemoryConfig } from "./config";

describe("codebase-memory config translation", () => {
  test("maps repo path and cache path", () => {
    const config = createDefaultConfig("/tmp/codebase-memory");
    const translated = translateCodebaseMemoryConfig("/tmp/codebase-memory", config);

    expect(translated.contract.env.REPO_PATH).toBe("/workspace");
    expect((translated.contract.env.CODEBASE_MEMORY_CACHE_PATH ?? "").includes("codebase-memory")).toBe(true);
  });
});
