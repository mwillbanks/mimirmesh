import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  doctorProject,
  loadCliContext,
  refreshProject,
  setupProject,
} from "../../../../apps/cli/src/lib/context";

import { createFixtureCopy } from "../fixtures";

describe("integration setup/refresh/doctor", () => {
  test("setup is non-destructive and refresh regenerates reports", async () => {
    const repo = await createFixtureCopy("docs-heavy");
    const readmePath = join(repo, "README.md");
    const before = await readFile(readmePath, "utf8");

    const context = await loadCliContext(repo);
    await setupProject(context);

    const after = await readFile(readmePath, "utf8");
    expect(after).toBe(before);

    const refreshed = await refreshProject(context);
    expect(refreshed.reports.length).toBe(5);
  }, 120_000);

  test("doctor returns actionable diagnostics", async () => {
    const repo = await createFixtureCopy("single-ts");
    const context = await loadCliContext(repo);
    const doctor = await doctorProject(context);

    expect(["healthy", "issues-found"]).toContain(doctor.status);
    expect(Array.isArray(doctor.issues)).toBe(true);
  }, 120_000);
});
