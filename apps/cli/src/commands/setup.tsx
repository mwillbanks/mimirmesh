import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import type zod from "zod/v4";

import { CommandRunner } from "../lib/command-runner";
import { resolvePresentationProfile, withPresentationOptions } from "../lib/presentation";
import { createSetupWorkflow } from "../workflows/init";

export const options = withPresentationOptions({}, { allowNonInteractive: true });

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function SetupCommand({ options, presentation, exitOnComplete, onComplete }: Props) {
	return (
		<CommandRunner
			definition={createSetupWorkflow()}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
