import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { installIdeConfig } from "../src/index";

describe("installer ide config", () => {
	test("writes vscode config using servers key", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-ide-vscode-"));
		const configPath = await installIdeConfig({
			projectRoot: repo,
			target: "vscode",
			serverCommand: "mimirmesh",
			serverArgs: ["server"],
		});

		const config = JSON.parse(await readFile(configPath, "utf8")) as {
			servers?: Record<string, unknown>;
			mcpServers?: Record<string, unknown>;
		};

		expect(config.servers).toBeDefined();
		expect(config.mcpServers).toBeUndefined();
	});

	test("writes cursor config using mcpServers key", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-ide-cursor-"));
		const configPath = await installIdeConfig({
			projectRoot: repo,
			target: "cursor",
			serverCommand: "mimirmesh",
			serverArgs: ["server"],
		});

		const config = JSON.parse(await readFile(configPath, "utf8")) as {
			servers?: Record<string, unknown>;
			mcpServers?: Record<string, unknown>;
		};

		expect(config.mcpServers).toBeDefined();
		expect(config.servers).toBeUndefined();
	});
});
