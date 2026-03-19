import { basename, join } from "node:path";

import { MIMIRMESH_DIR } from "../schema";

export const getMimirmeshDir = (projectRoot: string): string => join(projectRoot, MIMIRMESH_DIR);

export const getGlobalMimirmeshDir = (
	homeDirectory = process.env.MIMIRMESH_HOME ?? process.env.HOME ?? ".",
): string => join(homeDirectory, ".mimirmesh");

export const getConfigPath = (projectRoot: string): string =>
	join(getMimirmeshDir(projectRoot), "config.yml");

export const getGlobalConfigPath = (
	homeDirectory = process.env.MIMIRMESH_HOME ?? process.env.HOME ?? ".",
): string => join(getGlobalMimirmeshDir(homeDirectory), "config.yml");

export const runtimeDir = (projectRoot: string): string =>
	join(getMimirmeshDir(projectRoot), "runtime");

export const projectSlug = (projectRoot: string): string =>
	basename(projectRoot)
		.replace(/[^a-zA-Z0-9]/g, "-")
		.toLowerCase();
