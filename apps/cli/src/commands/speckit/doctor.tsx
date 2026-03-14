import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import type zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { speckitDoctor } from "../../lib/context";
import { createContextWorkflow } from "../../lib/context-workflow";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";

export const options = withPresentationOptions({});

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function SpeckitDoctorCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	return (
		<CommandRunner
			definition={createContextWorkflow({
				id: "speckit-doctor",
				title: "Spec Kit Doctor",
				description:
					"Run Spec Kit readiness diagnostics and surface any missing or inconsistent assets.",
				category: "setup",
				interactivePolicy: "default-non-interactive",
				recommendedNextActions: ["speckit-init", "speckit-status"],
				stepLabel: "Run Spec Kit diagnostics",
				stepKind: "validation",
				run: async (context) => {
					const result = await speckitDoctor(context);
					return {
						kind: result.ready ? "success" : "degraded",
						message: result.ready
							? "Spec Kit readiness checks passed."
							: "Spec Kit readiness checks found issues.",
						impact: result.ready
							? "Spec-driven workflows can rely on the current Spec Kit installation."
							: "Spec-driven workflows may be degraded until the reported Spec Kit issues are resolved.",
						nextAction: result.ready
							? "Continue with spec-driven workflows."
							: "Review the doctor findings and rerun `mimirmesh speckit init` if needed.",
						blockedCapabilities: result.ready ? [] : ["Fully healthy Spec Kit workflow support"],
						warnings: result.ready ? [] : result.findings,
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
