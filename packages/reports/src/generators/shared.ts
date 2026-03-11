import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { GeneratedReport } from "./types";

export const reportsDir = (projectRoot: string): string => join(projectRoot, ".mimirmesh", "reports");

export const readReportPath = (projectRoot: string, name: string): string =>
  join(reportsDir(projectRoot), name);

export const writeReport = async (
  projectRoot: string,
  name: string,
  content: string,
): Promise<GeneratedReport> => {
  const directory = reportsDir(projectRoot);
  await mkdir(directory, { recursive: true });
  const path = join(directory, name);
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  await writeFile(path, normalized, "utf8");
  return {
    name,
    path,
  };
};

export const section = (title: string, body: string): string => `## ${title}\n${body.trim()}\n`;

export const list = (values: string[], fallback = "None detected"): string => {
  if (values.length === 0) {
    return `- ${fallback}`;
  }
  return values.map((value) => `- ${value}`).join("\n");
};
