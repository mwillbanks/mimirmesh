import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export const ensureParentDir = async (path: string): Promise<void> => {
	await mkdir(dirname(path), { recursive: true });
};

export const appendLogLine = async (path: string, line: string): Promise<void> => {
	await ensureParentDir(path);
	await appendFile(path, line, "utf8");
};
