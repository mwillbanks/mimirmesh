import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import type zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { configValidate } from "../../lib/context";
import { createContextWorkflow } from "../../lib/context-workflow";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";

export const options = withPresentationOptions({});

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function ConfigValidateCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	return (
		<CommandRunner
			definition={createContextWorkflow({
				id: "config-validate",
				title: "Validate Configuration",
				description: "Validate the project-local config file and report schema errors explicitly.",
				category: "configuration",
				interactivePolicy: "default-non-interactive",
				recommendedNextActions: ["config-get", "config-set"],
				stepLabel: "Validate config file",
				stepKind: "validation",
				run: async (context) => {
					const validation = await configValidate(context);
					return {
						kind: validation.ok ? "success" : "failed",
						message: validation.ok
							? "Config file is valid."
							: "Config file contains validation errors.",
						impact: validation.ok
							? "The current config file satisfies the schema."
							: "Configuration-backed workflows may behave incorrectly until the listed validation errors are fixed.",
						nextAction: validation.ok
							? "Continue with the current configuration."
							: "Fix the reported config errors and rerun `mimirmesh config validate`.",
						blockedCapabilities: validation.ok ? [] : ["Trusted config-driven workflows"],
						warnings: validation.ok ? [] : validation.errors,
						evidence: [{ label: "Error count", value: String(validation.errors.length) }],
						machineReadablePayload: validation,
					};
				},
			})}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
