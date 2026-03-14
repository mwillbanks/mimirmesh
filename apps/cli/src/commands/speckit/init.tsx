import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import type zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { speckitInit } from "../../lib/context";
import { createContextWorkflow } from "../../lib/context-workflow";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";

export const options = withPresentationOptions({}, { allowNonInteractive: true });

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function SpeckitInitCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	return (
		<CommandRunner
			definition={createContextWorkflow({
				id: "speckit-init",
				title: "Initialize Spec Kit",
				description:
					"Install or verify the Spec Kit assets used for spec-driven development workflows.",
				category: "setup",
				interactivePolicy: "default-interactive",
				recommendedNextActions: ["speckit-status", "init"],
				stepLabel: "Initialize Spec Kit",
				stepKind: "generation",
				run: async (context) => {
					const result = await speckitInit(context);
					return {
						kind: result.initialized ? "success" : "degraded",
						message: result.initialized
							? "Spec Kit initialization signals are present."
							: "Spec Kit initialization needs additional setup.",
						impact: result.initialized
							? "Spec-driven workflows can locate the local Spec Kit assets."
							: "Spec-driven workflows are only partially available until Spec Kit finishes installing.",
						nextAction: result.initialized
							? "Run `mimirmesh speckit status` to confirm readiness."
							: "Review the Spec Kit output and rerun initialization if needed.",
						blockedCapabilities: result.initialized
							? []
							: ["Fully ready Spec Kit workflow support"],
						machineReadablePayload: result,
					};
				},
			})}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
