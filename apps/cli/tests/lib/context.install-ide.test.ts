import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { type CliContext, installIde } from "../../src/lib/context";

const makeExecutable = async (path: string): Promise<void> => {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, "#!/usr/bin/env sh\nexit 0\n", "utf8");
	await chmod(path, 0o755);
};

describe("cli install ide server resolution", () => {
	const originalArgv0 = process.argv[0] ?? "";
	const originalServerBin = process.env.MIMIRMESH_SERVER_BIN;
	const originalPath = process.env.PATH;

	beforeEach(() => {
		process.env.MIMIRMESH_SERVER_BIN = "";
	});

	afterEach(() => {
		process.argv[0] = originalArgv0;
		process.env.MIMIRMESH_SERVER_BIN = originalServerBin;
		process.env.PATH = originalPath;
	});

	test("prefers local dist/mimirmesh-server over global PATH server binary", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-install-ide-priority-"));
		const distServer = join(repo, "dist", "mimirmesh-server");
		const staleServer = join(repo, "bin", "mimirmesh-server");
		await makeExecutable(distServer);
		await makeExecutable(staleServer);
		process.argv[0] = "/usr/bin/env";
		process.env.PATH = `${join(repo, "bin")}:${originalPath ?? ""}`;

		const result = await installIde({ projectRoot: repo } as CliContext, "vscode");
		expect(result.serverCommand).toBe(resolve(distServer));
		expect(result.serverArgs).toEqual([]);
		const config = JSON.parse(await readFile(result.configPath, "utf8")) as {
			servers: { mimirmesh: { command: string } };
		};
		expect(config.servers.mimirmesh.command).toBe(resolve(distServer));
	});

	test("uses the current mimirmesh binary with server subcommand when invoked directly", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-install-ide-mimirmesh-"));
		const mimirmeshBin = join(repo, "bin", "mimirmesh");
		await makeExecutable(mimirmeshBin);
		process.argv[0] = mimirmeshBin;

		const result = await installIde({ projectRoot: repo } as CliContext, "vscode");
		expect(result.serverCommand).toBe(resolve(mimirmeshBin));
		expect(result.serverArgs).toEqual(["server"]);
	});
});
