import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { configGet } from "../../lib/context";
import { createContextWorkflow } from "../../lib/context-workflow";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";

export const options = withPresentationOptions({
	path: zod.string().optional().describe("Dot path inside config (defaults to full config)"),
});

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function ConfigGetCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	return (
		<CommandRunner
			definition={createContextWorkflow({
				id: "config-get",
				title: "Read Configuration",
				description: "Inspect project-local config values without mutating the current setup.",
				category: "configuration",
				interactivePolicy: "default-non-interactive",
				recommendedNextActions: ["config-validate", "config-set"],
				stepLabel: "Read configuration value",
				stepKind: "discovery",
				run: async (context) => {
					const value = await configGet(context, options.path ?? "");
					const renderedValue = typeof value === "string" ? value : JSON.stringify(value, null, 2);
					return {
						kind: "success",
						message: options.path
							? `Read config path ${options.path}.`
							: "Read the full project configuration.",
						impact: "The current project-local configuration is now visible in the CLI.",
						nextAction: options.path
							? "Use `mimirmesh config set` if this path needs to change."
							: "Use `mimirmesh config validate` to confirm the current file is valid.",
						evidence: [
							{ label: "Path", value: options.path ?? "(full config)" },
							{ label: "Value", value: renderedValue },
						],
						machineReadablePayload: {
							path: options.path ?? "",
							value,
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
