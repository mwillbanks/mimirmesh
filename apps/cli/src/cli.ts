#!/usr/bin/env bun
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import Pastel from "pastel";

import { runFallbackCli } from "./fallback";
import { runPastelSourceRuntime } from "./lib/pastel-source-runtime";

const commandsDirectory = fileURLToPath(new URL("./commands", import.meta.url));
const sourceRoot = fileURLToPath(new URL(".", import.meta.url));
const appName = "mimirmesh";
const appDescription = "MímirMesh local-first project intelligence platform";

const hasCommandsDirectory = async (): Promise<boolean> => {
	try {
		await access(commandsDirectory);
		return true;
	} catch {
		return false;
	}
};

if (await hasCommandsDirectory()) {
	if (process.env.MIMIRMESH_PASTEL_DIRECT === "1") {
		const app = new Pastel({
			importMeta: import.meta,
			name: appName,
			description: appDescription,
		});
		await app.run();
	} else {
		await runPastelSourceRuntime(sourceRoot, appName, appDescription);
	}
} else {
	process.exit(await runFallbackCli(process.argv.slice(2)));
}
