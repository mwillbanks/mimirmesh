import type { EngineId } from "@mimirmesh/config";
import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import { argument } from "pastel";
import zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";
import { createMcpRouteHintsWorkflow } from "../../workflows/mcp";

export const args = zod.tuple([
	zod
		.string()
		.optional()
		.describe(argument({ name: "unifiedTool", description: "Optional unified tool to inspect" })),
]);

export const options = withPresentationOptions(
	{
		route: zod.string().optional(),
		profile: zod.string().optional(),
		includeRollups: zod.boolean().optional(),
		limitBuckets: zod.number().int().positive().max(32).optional(),
	},
	{ allowNonInteractive: true },
);

const parseRouteOption = (
	route: string | undefined,
): { engine?: EngineId; engineTool?: string } => {
	if (!route) {
		return {};
	}
	const separatorIndex = route.indexOf(":");
	if (separatorIndex <= 0 || separatorIndex === route.length - 1) {
		throw new Error("Route must be provided as <engine>:<engineTool>.");
	}
	const engine = route.slice(0, separatorIndex) as EngineId;
	const engineTool = route.slice(separatorIndex + 1);
	return { engine, engineTool };
};

type Props = {
	args: zod.infer<typeof args>;
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function McpRouteHintsCommand({
	args,
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const [unifiedTool] = args;
	const route = parseRouteOption(options.route);

	return (
		<CommandRunner
			definition={createMcpRouteHintsWorkflow({
				unifiedTool,
				engine: route.engine,
				engineTool: route.engineTool,
				profile: options.profile,
				includeRollups: options.includeRollups,
				limitBuckets: options.limitBuckets,
			})}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
