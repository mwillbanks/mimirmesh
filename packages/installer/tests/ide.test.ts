import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { installIdeConfig } from "../src/index";

type IdeServerEntry = {
	args?: string[];
};

type IdeConfig = {
	servers?: Record<string, unknown> & {
		mimirmesh?: IdeServerEntry;
	};
	mcpServers?: Record<string, unknown> & {
		mimirmesh?: IdeServerEntry;
	};
};

describe("installer ide config", () => {
	test("writes vscode config using servers key", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-ide-vscode-"));
		const configPath = await installIdeConfig({
			projectRoot: repo,
			target: "vscode",
			serverCommand: "$HOME/.local/bin/mimirmesh-server",
			serverArgs: [],
		});

		const config = JSON.parse(await readFile(configPath, "utf8")) as IdeConfig;

		expect(config.servers).toBeDefined();
		expect(config.mcpServers).toBeUndefined();
		expect(config.servers?.mimirmesh?.args).toBeUndefined();
	});

	test("writes cursor config using mcpServers key", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-ide-cursor-"));
		const configPath = await installIdeConfig({
			projectRoot: repo,
			target: "cursor",
			serverCommand: "$HOME/.local/bin/mimirmesh-server",
			serverArgs: [],
		});

		const config = JSON.parse(await readFile(configPath, "utf8")) as IdeConfig;

		expect(config.mcpServers).toBeDefined();
		expect(config.servers).toBeUndefined();
		expect(config.mcpServers?.mimirmesh?.args).toBeUndefined();
	});
});
