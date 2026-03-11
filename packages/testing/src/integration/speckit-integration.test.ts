import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";

import {
	loadCliContext,
	speckitDoctor,
	speckitInit,
	speckitStatus,
} from "../../../../apps/cli/src/lib/context";

import { createFixtureCopy } from "../fixtures";
import { createSpecifyStub } from "../harness/specify-stub";

describe("integration speckit", () => {
  afterEach(() => {
    delete process.env.MIMIRMESH_SPECIFY_BIN;
  });

  test("init/status/doctor flows work", async () => {
    const repo = await createFixtureCopy("single-ts");
    process.env.MIMIRMESH_SPECIFY_BIN = await createSpecifyStub(join(repo, ".mimirmesh", "testing"));
    const context = await loadCliContext(repo);

    const before = await speckitStatus(context);
    expect(before.initialized).toBe(false);
    expect(before.ready).toBe(false);
    expect(before.missing).toContain(".specify");

    const initialized = await speckitInit(context);
    expect(initialized.initialized).toBe(true);
    expect(initialized.status.ready).toBe(true);
    expect(initialized.status.signals.includes("docs/specifications")).toBe(true);
    expect(initialized.status.findings).toHaveLength(0);

    const status = await speckitStatus(context);
    expect(status.initialized).toBe(true);
    expect(status.ready).toBe(true);
    expect(status.binary).toBe(process.env.MIMIRMESH_SPECIFY_BIN ?? null);
    expect(status.agent).toBe("codex");

    const doctor = await speckitDoctor(context);
    expect(doctor.ready).toBe(true);
    expect(doctor.findings).toHaveLength(0);
  });
});
