import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import { argument } from "pastel";
import zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { showReport } from "../../lib/context";
import { createContextWorkflow } from "../../lib/context-workflow";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";

export const args = zod.tuple([
	zod
		.string()
		.describe(
			argument({ name: "name", description: "Report filename (example: project-summary.md)" }),
		),
]);

export const options = withPresentationOptions({});

type Props = {
	args: zod.infer<typeof args>;
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function ReportShowCommand({
	args,
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const [name] = args;
	return (
		<CommandRunner
			definition={createContextWorkflow({
				id: "report-show",
				title: "Show Report",
				description: "Read a generated report from the project-local reports directory.",
				category: "reporting",
				interactivePolicy: "default-non-interactive",
				recommendedNextActions: ["report-generate"],
				stepLabel: "Read report",
				stepKind: "discovery",
				run: async (context) => {
					const content = await showReport(context, name);
					return {
						kind: "success",
						message: `Loaded report ${name}.`,
						impact: "The requested report content is available for direct inspection.",
						nextAction: "Review the report content or regenerate reports if it is stale.",
						evidence: [
							{ label: "Report", value: name },
							{ label: "Content", value: content },
						],
						machineReadablePayload: {
							name,
							content,
						},
					};
				},
			})}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
