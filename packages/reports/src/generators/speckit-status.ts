import { detectSpecKit } from "@mimirmesh/workspace";

import { list, section, writeReport } from "./shared";
import type { GeneratedReport } from "./types";

export const generateSpecKitReport = async (projectRoot: string): Promise<GeneratedReport> => {
	const status = await detectSpecKit(projectRoot);
	const content = [
		"# Spec Kit Status",
		"",
		section("Initialized", `- ${status.initialized ? "yes" : "no"}`),
		section("Ready", `- ${status.ready ? "yes" : "no"}`),
		section("Agent", `- ${status.agent ?? "unknown"}`),
		section(
			"Specify CLI",
			list([
				status.binary ? `binary: ${status.binary}` : "binary: unavailable",
				status.version ? `version: ${status.version}` : "version: unknown",
				`mode: ${status.installMode}`,
			]),
		),
		section(
			"Spec Paths",
			list([`translated: ${status.translatedSpecsDir}`, `legacy: ${status.legacySpecsDir}`]),
		),
		section("Signals", list(status.signals, "No Spec Kit signals found")),
		section("Missing Readiness Inputs", list(status.missing, "No missing readiness signals")),
		section("Findings", list(status.findings, "No Spec Kit findings")),
	].join("\n");
	return writeReport(projectRoot, "speckit-status.md", content);
};
