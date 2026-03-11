#!/usr/bin/env bun
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import Pastel from "pastel";

import { runFallbackCli } from "./fallback";

const commandsDirectory = fileURLToPath(new URL("./commands", import.meta.url));

const hasCommandsDirectory = async (): Promise<boolean> => {
	try {
		await access(commandsDirectory);
		return true;
	} catch {
		return false;
	}
};

const app = new Pastel({
	importMeta: import.meta,
	name: "mimirmesh",
	description: "MímirMesh local-first project intelligence platform",
});

if (await hasCommandsDirectory()) {
	await app.run();
} else {
	process.exit(await runFallbackCli(process.argv.slice(2)));
}
