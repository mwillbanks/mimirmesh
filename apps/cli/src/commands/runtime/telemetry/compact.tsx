import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import zod from "zod/v4";

import { CommandRunner } from "../../../lib/command-runner";
import { resolvePresentationProfile, withPresentationOptions } from "../../../lib/presentation";
import { createRuntimeTelemetryCompactWorkflow } from "../../../workflows/runtime";

const scopeSchema = zod.enum(["repo", "tool", "route"]);

const parseRouteTarget = (
	value?: string,
): { engine: "srclight" | "document-mcp" | "mcp-adr-analysis-server"; engineTool: string } => {
	if (!value) {
		throw new Error("A route target is required when --scope route is selected.");
	}
	const [engine, ...toolParts] = value.split(":");
	const engineTool = toolParts.join(":").trim();
	if (
		(engine !== "srclight" && engine !== "document-mcp" && engine !== "mcp-adr-analysis-server") ||
		!engineTool
	) {
		throw new Error("Route must use the form <engine>:<tool>.");
	}
	return { engine, engineTool };
};

const resolveScope = (options: {
	scope?: "repo" | "tool" | "route";
	tool?: string;
	route?: string;
}) => {
	const scope = options.scope ?? "repo";
	if (scope === "repo") {
		return { scope: "repo" as const };
	}
	if (scope === "tool") {
		if (!options.tool) {
			throw new Error("--tool is required when --scope tool is selected.");
		}
		return { scope: "tool" as const, unifiedTool: options.tool };
	}
	if (!options.tool) {
		throw new Error("--tool is required when --scope route is selected.");
	}
	const route = parseRouteTarget(options.route);
	return {
		scope: "route" as const,
		unifiedTool: options.tool,
		engine: route.engine,
		engineTool: route.engineTool,
	};
};

export const options = withPresentationOptions(
	{
		scope: scopeSchema.optional(),
		tool: zod.string().optional(),
		route: zod.string().optional(),
	},
	{ allowNonInteractive: true },
);

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function RuntimeTelemetryCompactCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const resolvedScope = resolveScope(options);

	return (
		<CommandRunner
			definition={createRuntimeTelemetryCompactWorkflow(resolvedScope)}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
