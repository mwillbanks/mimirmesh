import type { MimirmeshConfig } from "@mimirmesh/config";

import { generateArchitectureReport } from "./generators/architecture";
import { generateDeploymentReport } from "./generators/deployment";
import { generateProjectSummaryReport } from "./generators/project-summary";
import { generateRuntimeHealthReport } from "./generators/runtime-health";
import { readReportPath } from "./generators/shared";
import { generateSpecKitReport } from "./generators/speckit-status";
import type { GeneratedReport } from "./generators/types";

export type { GeneratedReport };

export {
	generateArchitectureReport,
	generateDeploymentReport,
	generateProjectSummaryReport,
	generateRuntimeHealthReport,
	generateSpecKitReport,
	readReportPath,
};

export const generateAllReports = async (
	projectRoot: string,
	config: MimirmeshConfig,
): Promise<GeneratedReport[]> => {
	return [
		await generateProjectSummaryReport(projectRoot),
		await generateArchitectureReport(projectRoot),
		await generateDeploymentReport(projectRoot),
		await generateRuntimeHealthReport(projectRoot, config),
		await generateSpecKitReport(projectRoot),
	];
};
