import {
	GuidedSelect,
	type PresentationProfile,
	SpinnerLine,
	type WorkflowRunState,
} from "@mimirmesh/ui";
import { Box, Text } from "ink";
import { argument } from "pastel";
import { useEffect, useState } from "react";
import zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { loadCliContext, mcpListTools } from "../../lib/context";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";
import { createMcpToolWorkflow } from "../../workflows/mcp";

export const args = zod.tuple([
	zod
		.string()
		.optional()
		.describe(argument({ name: "tool", description: "Unified or passthrough MCP tool name" })),
	zod
		.string()
		.optional()
		.describe(argument({ name: "args", description: "Optional JSON object argument payload" })),
]);

export const options = withPresentationOptions({}, { allowNonInteractive: true });

type Props = {
	args: zod.infer<typeof args>;
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

const parsePayload = (value?: string): Record<string, unknown> => {
	if (!value) {
		return {};
	}
	const parsed = JSON.parse(value) as unknown;
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error("Tool arguments must be a JSON object.");
	}
	return parsed as Record<string, unknown>;
};

export default function McpToolCommand({
	args,
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const [requestedTool, payload] = args;
	const resolvedPresentation = presentation ?? resolvePresentationProfile(options);
	const [selectedTool, setSelectedTool] = useState<string | null>(requestedTool ?? null);
	const [toolOptions, setToolOptions] = useState<
		Array<{ label: string; value: string; description?: string }>
	>([]);
	const [loading, setLoading] = useState<boolean>(!requestedTool);
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		if (requestedTool) {
			return;
		}
		let mounted = true;
		const loadTools = async () => {
			try {
				const context = await loadCliContext();
				const tools = await mcpListTools(context);
				if (!mounted) {
					return;
				}
				setToolOptions(
					tools.map((tool) => ({
						label: tool.name,
						value: tool.name,
						description: tool.description,
					})),
				);
			} catch (error) {
				if (!mounted) {
					return;
				}
				setLoadError(error instanceof Error ? error.message : String(error));
			} finally {
				if (mounted) {
					setLoading(false);
				}
			}
		};
		void loadTools();
		return () => {
			mounted = false;
		};
	}, [requestedTool]);

	if (!requestedTool && selectedTool === null) {
		if (loading) {
			return (
				<Box flexDirection="column" gap={1}>
					<Text bold>Invoke MCP Tool</Text>
					<SpinnerLine
						label="Loading the current MCP tool list"
						reducedMotion={resolvedPresentation.reducedMotion}
					/>
				</Box>
			);
		}

		if (loadError) {
			return (
				<CommandRunner
					definition={{
						...createMcpToolWorkflow("unresolved-tool", {}),
						execute: async () => ({
							kind: "failed",
							message: loadError,
							impact:
								"MCP tool selection could not start because the tool list could not be loaded.",
							completedWork: [],
							blockedCapabilities: ["Guided MCP tool selection"],
							nextAction:
								"Run `mimirmesh mcp list-tools` or fix the runtime issue before retrying.",
						}),
					}}
					presentation={resolvedPresentation}
					exitOnComplete={exitOnComplete}
					onComplete={onComplete}
				/>
			);
		}

		if (!resolvedPresentation.interactive) {
			return (
				<CommandRunner
					definition={{
						...createMcpToolWorkflow("unresolved-tool", {}),
						execute: async () => ({
							kind: "failed",
							message: "A tool name is required in non-interactive mode.",
							impact:
								"The CLI cannot open a guided MCP tool selector in a non-interactive terminal.",
							completedWork: [],
							blockedCapabilities: ["Guided MCP tool selection"],
							nextAction:
								'Re-run `mimirmesh mcp tool <tool> \'{"key":"value"}\' --non-interactive` or use an interactive terminal.',
						}),
					}}
					presentation={resolvedPresentation}
					exitOnComplete={exitOnComplete}
					onComplete={onComplete}
				/>
			);
		}

		return (
			<Box flexDirection="column" gap={1}>
				<GuidedSelect
					title="Choose an MCP tool"
					reason="This workflow can route to unified or passthrough MCP tools, so selecting the correct tool avoids accidental calls."
					consequence="The chosen tool will be invoked immediately with the provided JSON payload, if any."
					nonInteractiveFallback={`mimirmesh mcp tool <tool> '{"key":"value"}' --non-interactive`}
					choices={toolOptions.map((tool, index) => ({
						label: tool.label,
						value: tool.value,
						description: tool.description,
						recommended: index === 0,
					}))}
					onSubmit={(value) => {
						setSelectedTool(value);
					}}
				/>
			</Box>
		);
	}

	return (
		<CommandRunner
			definition={createMcpToolWorkflow(
				selectedTool ?? requestedTool ?? "unknown-tool",
				parsePayload(payload),
			)}
			presentation={resolvedPresentation}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
