import type { EngineId } from "@mimirmesh/config";
import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import { argument } from "pastel";
import type zod from "zod/v4";
import z from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";
import { createMcpLoadToolsWorkflow } from "../../workflows/mcp";

export const args = z.tuple([
	z
		.enum(["srclight", "document-mcp", "mcp-adr-analysis-server"])
		.describe(argument({ name: "engine", description: "Deferred engine group to load" })),
]);

export const options = withPresentationOptions({}, { allowNonInteractive: true });

type Props = {
	args: zod.infer<typeof args>;
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function McpLoadToolsCommand({
	args,
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const [engine] = args;
	return (
		<CommandRunner
			definition={createMcpLoadToolsWorkflow(engine as EngineId)}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
