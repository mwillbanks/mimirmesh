import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import type zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { generateReports } from "../../lib/context";
import { createContextWorkflow } from "../../lib/context-workflow";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";

export const options = withPresentationOptions({}, { allowNonInteractive: true });

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function ReportGenerateCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	return (
		<CommandRunner
			definition={createContextWorkflow({
				id: "report-generate",
				title: "Generate Reports",
				description:
					"Regenerate project-local reports from the current repository and runtime state.",
				category: "reporting",
				interactivePolicy: "default-interactive",
				recommendedNextActions: ["report-show", "runtime-status"],
				stepLabel: "Generate reports",
				stepKind: "reporting",
				run: async (context) => {
					const reports = await generateReports(context);
					return {
						kind: "success",
						message: `Generated ${reports.length} report(s).`,
						impact: "Project-local report files now reflect the latest generated content.",
						nextAction: reports[0]
							? `Run \`mimirmesh report show ${reports[0].split("/").at(-1) ?? ""}\` to inspect a report.`
							: "Run `mimirmesh report show <name>` to inspect a report.",
						evidence: [{ label: "Report count", value: String(reports.length) }],
						machineReadablePayload: { reports },
					};
				},
			})}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
