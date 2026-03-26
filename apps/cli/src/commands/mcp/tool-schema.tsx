import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import { argument } from "pastel";
import type zod from "zod/v4";
import z from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";
import { createMcpToolSchemaWorkflow } from "../../workflows/mcp";

export const args = z.tuple([
	z
		.string()
		.min(1)
		.describe(argument({ name: "tool", description: "Visible tool name to inspect" })),
]);

export const options = withPresentationOptions({
	view: z.enum(["compressed", "full", "debug"]).optional(),
});

type Props = {
	args: zod.infer<typeof args>;
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function McpToolSchemaCommand({
	args,
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const [toolName] = args;
	return (
		<CommandRunner
			definition={createMcpToolSchemaWorkflow(toolName, options.view ?? "full")}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
