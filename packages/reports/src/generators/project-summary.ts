import { analyzeRepository } from "@mimirmesh/workspace";

import { list, section, writeReport } from "./shared";
import type { GeneratedReport } from "./types";

export const generateProjectSummaryReport = async (
  projectRoot: string,
): Promise<GeneratedReport> => {
  const analysis = await analyzeRepository(projectRoot);
  const content = [
    "# Project Summary",
    "",
    section("Repository Shape", `- ${analysis.shape}`),
    section("Languages", list(analysis.languages)),
    section("Frameworks", list(analysis.frameworks)),
    section("Package Managers", list(analysis.packageManagers)),
    section("Key Directories", list(analysis.keyDirectories)),
    section("Entrypoints", list(analysis.entrypoints)),
    section("File Count", `- ${analysis.fileCount}`),
  ].join("\n");

  return writeReport(projectRoot, "project-summary.md", content);
};
