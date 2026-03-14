import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import zod from "zod/v4";

import { CommandRunner } from "../lib/command-runner";
import { resolvePresentationProfile, withPresentationOptions } from "../lib/presentation";
import { createUpdateWorkflow } from "../workflows/init";

export const options = withPresentationOptions(
	{
		check: zod.boolean().default(false).describe("Check for updates without applying"),
	},
	{ allowNonInteractive: true },
);

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function UpdateCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	return (
		<CommandRunner
			definition={createUpdateWorkflow(options.check)}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
