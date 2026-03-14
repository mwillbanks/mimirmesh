import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import type zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";
import { createRuntimeActionWorkflow } from "../../workflows/runtime";

export const options = withPresentationOptions({});

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function RuntimeStatusCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	return (
		<CommandRunner
			definition={createRuntimeActionWorkflow("status")}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
