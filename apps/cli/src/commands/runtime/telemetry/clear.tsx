import { GuidedConfirm, type PresentationProfile, type WorkflowRunState } from "@mimirmesh/ui";
import { Box } from "ink";
import { useState } from "react";
import zod from "zod/v4";

import { CommandRunner } from "../../../lib/command-runner";
import { createGuardedWorkflow } from "../../../lib/guarded-workflow";
import { getPromptGuardError, shouldPrompt } from "../../../lib/non-interactive";
import { resolvePresentationProfile, withPresentationOptions } from "../../../lib/presentation";
import { createRuntimeTelemetryClearWorkflow } from "../../../workflows/runtime";

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

const describeScope = (options: {
	scope?: "repo" | "tool" | "route";
	tool?: string;
	route?: string;
}) => {
	const scope = options.scope ?? "repo";
	if (scope === "repo") {
		return "the full repository";
	}
	if (scope === "tool") {
		if (!options.tool) {
			throw new Error("--tool is required when --scope tool is selected.");
		}
		return `tool ${options.tool}`;
	}
	if (!options.tool) {
		throw new Error("--tool is required when --scope route is selected.");
	}
	const route = parseRouteTarget(options.route);
	return `route ${options.tool} (${route.engine}:${route.engineTool})`;
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

export default function RuntimeTelemetryClearCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const resolvedPresentation = presentation ?? resolvePresentationProfile(options);
	const resolvedScope = resolveScope(options);
	const [confirmed, setConfirmed] = useState<boolean>(false);
	const [cancelled, setCancelled] = useState<boolean>(false);
	const scopeDescription = describeScope(options);
	const baseDefinition = createRuntimeTelemetryClearWorkflow(resolvedScope);
	const promptError = getPromptGuardError({
		command: "`mimirmesh runtime telemetry clear`",
		presentation: resolvedPresentation,
		interactivePolicy: "default-interactive",
		explicitNonInteractive: options.nonInteractive,
	});

	if (cancelled) {
		return (
			<CommandRunner
				definition={createGuardedWorkflow(
					baseDefinition,
					"Route telemetry clear cancelled.",
					"No route telemetry was removed.",
					[],
					"Re-run the command and confirm the clear action if you still want to remove telemetry.",
				)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	if (promptError) {
		return (
			<CommandRunner
				definition={createGuardedWorkflow(
					baseDefinition,
					promptError,
					"Route telemetry clear did not begin because this workflow needs an explicit automation-safe invocation.",
					["Route telemetry clear"],
					"Re-run `mimirmesh runtime telemetry clear --scope repo|tool|route --non-interactive` or use an interactive terminal.",
				)}
				presentation={resolvedPresentation}
				exitOnComplete={exitOnComplete}
				onComplete={onComplete}
			/>
		);
	}

	if (
		!confirmed &&
		shouldPrompt({
			command: "`mimirmesh runtime telemetry clear`",
			presentation: resolvedPresentation,
			interactivePolicy: "default-interactive",
			explicitNonInteractive: options.nonInteractive,
		})
	) {
		return (
			<Box>
				<GuidedConfirm
					title="Confirm route telemetry clear"
					reason="Clearing route telemetry removes stored events, rollups, and snapshots for the selected scope."
					consequence={`This will clear telemetry for ${scopeDescription}.`}
					nonInteractiveFallback="mimirmesh runtime telemetry clear --scope repo|tool|route --non-interactive"
					onConfirm={() => {
						setConfirmed(true);
					}}
					onCancel={() => {
						setCancelled(true);
					}}
				/>
			</Box>
		);
	}

	return (
		<CommandRunner
			definition={baseDefinition}
			presentation={resolvedPresentation}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
