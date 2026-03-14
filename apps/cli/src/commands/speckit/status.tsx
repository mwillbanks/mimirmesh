import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import type zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { speckitStatus } from "../../lib/context";
import { createContextWorkflow } from "../../lib/context-workflow";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";

export const options = withPresentationOptions({});

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function SpeckitStatusCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	return (
		<CommandRunner
			definition={createContextWorkflow({
				id: "speckit-status",
				title: "Spec Kit Status",
				description: "Inspect the readiness of the local Spec Kit installation.",
				category: "setup",
				interactivePolicy: "default-non-interactive",
				recommendedNextActions: ["speckit-init", "speckit-doctor"],
				stepLabel: "Inspect Spec Kit readiness",
				stepKind: "discovery",
				run: async (context) => {
					const status = await speckitStatus(context);
					return {
						kind: status.ready ? "success" : "degraded",
						message: status.ready ? "Spec Kit is ready." : "Spec Kit readiness is incomplete.",
						impact: status.ready
							? "Spec-driven CLI workflows can locate the expected Spec Kit assets."
							: "Spec-driven CLI workflows may be limited until Spec Kit readiness is complete.",
						nextAction: status.ready
							? "Continue with spec-driven workflows."
							: "Run `mimirmesh speckit init` or `mimirmesh speckit doctor` for more detail.",
						blockedCapabilities: status.ready ? [] : ["Fully ready Spec Kit workflow support"],
						machineReadablePayload: status,
					};
				},
			})}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
