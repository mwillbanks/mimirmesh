import { analyzeRepository } from "@mimirmesh/workspace";

import { list, section, writeReport } from "./shared";
import type { GeneratedReport } from "./types";

export const generateArchitectureReport = async (projectRoot: string): Promise<GeneratedReport> => {
	const analysis = await analyzeRepository(projectRoot);
	const inferredSubsystems = analysis.keyDirectories
		.filter((directory) => ["apps", "packages", "services", "src", "docs"].includes(directory))
		.map((directory) => `Subsystem: ${directory}`);

	const content = [
		"# Architecture Overview",
		"",
		section("Major Subsystems", list(inferredSubsystems, "No major subsystem boundaries inferred")),
		section(
			"Services and Runtime Hints",
			list(analysis.dockerFiles, "No containerized services detected"),
		),
		section("Dependencies and CI Signals", list(analysis.ciFiles, "No CI/CD files detected")),
		section("Relevant Entrypoints", list(analysis.entrypoints)),
	].join("\n");

	return writeReport(projectRoot, "architecture.md", content);
};
