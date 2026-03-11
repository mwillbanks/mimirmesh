import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { getMimirmeshDir } from "@mimirmesh/config";

const requiredDirectories = [
  "",
  "logs",
  "logs/sessions",
  "memory",
  "templates",
  "reports",
  "indexes",
  "runtime",
  "runtime/images",
  "runtime/engines",
  "cache",
];

export const ensureProjectLayout = async (projectRoot: string): Promise<void> => {
  const root = getMimirmeshDir(projectRoot);
  for (const directory of requiredDirectories) {
    await mkdir(join(root, directory), { recursive: true });
  }
};
