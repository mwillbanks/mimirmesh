import { cp, mkdir, mkdtemp, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const commandFilePattern = /\.(?:[cm]?[jt]sx?)$/;
const testFilePattern = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

const copyCommandsTree = async (
	sourceDirectory: string,
	targetDirectory: string,
): Promise<void> => {
	await mkdir(targetDirectory, { recursive: true });

	for (const entry of await readdir(sourceDirectory)) {
		const sourcePath = path.join(sourceDirectory, entry);
		const targetPath = path.join(targetDirectory, entry);
		const sourceStat = await stat(sourcePath);

		if (sourceStat.isDirectory()) {
			await copyCommandsTree(sourcePath, targetPath);
			continue;
		}

		if (!commandFilePattern.test(entry) || entry.endsWith(".d.ts") || testFilePattern.test(entry)) {
			continue;
		}

		await cp(sourcePath, targetPath);
	}
};

export const runPastelSourceRuntime = async (
	sourceRoot: string,
	name: string,
	description: string,
): Promise<void> => {
	const stagingRoot = await mkdtemp(path.join(sourceRoot, ".pastel-runtime-"));

	try {
		await copyCommandsTree(path.join(sourceRoot, "commands"), path.join(stagingRoot, "commands"));

		for (const directory of ["lib", "ui", "workflows"]) {
			await symlink(path.join(sourceRoot, directory), path.join(stagingRoot, directory), "dir");
		}

		const entryPath = path.join(stagingRoot, "entry.mjs");
		await writeFile(
			entryPath,
			[
				'import Pastel from "pastel";',
				`const app = new Pastel({ importMeta: import.meta, name: ${JSON.stringify(name)}, description: ${JSON.stringify(description)} });`,
				"await app.run();",
			].join("\n"),
			"utf8",
		);

		await import(pathToFileURL(entryPath).href);
	} finally {
		await rm(stagingRoot, { recursive: true, force: true });
	}
};
