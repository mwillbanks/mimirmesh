import { basename, join } from "node:path";

import { MIMIRMESH_DIR } from "../schema";

export const getMimirmeshDir = (projectRoot: string): string => join(projectRoot, MIMIRMESH_DIR);

export const getConfigPath = (projectRoot: string): string =>
  join(getMimirmeshDir(projectRoot), "config.yml");

export const runtimeDir = (projectRoot: string): string =>
  join(getMimirmeshDir(projectRoot), "runtime");

export const projectSlug = (projectRoot: string): string =>
  basename(projectRoot)
    .replace(/[^a-zA-Z0-9]/g, "-")
    .toLowerCase();
