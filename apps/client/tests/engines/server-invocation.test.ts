import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { resolveServerInvocation } from "../../src/engines/server-invocation";

const makeExecutable = async (path: string): Promise<void> => {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, "#!/usr/bin/env sh\nexit 0\n", "utf8");
	await chmod(path, 0o755);
};

describe("client server invocation", () => {
	const originalServerBin = process.env.MIMIRMESH_SERVER_BIN;

	afterEach(() => {
		process.env.MIMIRMESH_SERVER_BIN = originalServerBin;
	});

	test("uses explicit server binary when provided", async () => {
		const root = await mkdtemp(join(tmpdir(), "mimirmesh-client-server-"));
		const explicitServer = join(root, "bin", "mimirmesh-server");
		await makeExecutable(explicitServer);

		process.env.MIMIRMESH_SERVER_BIN = explicitServer;
		const resolved = await resolveServerInvocation(root);

		expect(resolved.command).toBe(resolve(explicitServer));
		expect(resolved.args).toEqual([]);
	});
});
