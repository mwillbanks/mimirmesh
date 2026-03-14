import { analyzeRepository } from "@mimirmesh/workspace";

import { list, section, writeReport } from "./shared";
import type { GeneratedReport } from "./types";

export const generateDeploymentReport = async (projectRoot: string): Promise<GeneratedReport> => {
	const analysis = await analyzeRepository(projectRoot);
	const deploymentSignals = [
		...analysis.dockerFiles,
		...analysis.ciFiles,
		...analysis.iacFiles,
	].sort();
	const uniqueSignals = [...new Set(deploymentSignals)];

	const content = [
		"# Deployment Signals",
		"",
		section("Deployment and Runtime Files", list(uniqueSignals, "No deployment files detected")),
		section("CI/CD Files", list(analysis.ciFiles, "No CI/CD workflow files detected")),
		section("IaC Files", list(analysis.iacFiles, "No IaC artifacts detected")),
	].join("\n");

	return writeReport(projectRoot, "deployment.md", content);
};
