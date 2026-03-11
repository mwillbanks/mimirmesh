import { argument } from "pastel";
import zod from "zod";

import { CommandRunner } from "../../lib/command-runner";
import { loadCliContext, mcpCallTool } from "../../lib/context";

export const args = zod.tuple([
	zod
		.string()
		.describe(argument({ name: "tool", description: "Unified or passthrough MCP tool name" })),
	zod
		.string()
		.optional()
		.describe(argument({ name: "args", description: "Optional JSON object argument payload" })),
]);

type Props = {
	args: zod.infer<typeof args>;
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

export default function McpToolCommand({ args }: Props) {
	const [tool, payload] = args;
	return (
		<CommandRunner
			title={`Invoke MCP Tool (${tool})`}
			run={async () => {
				const context = await loadCliContext();
				const result = await mcpCallTool(context, tool, parsePayload(payload));
				return {
					state: result.success ? "success" : "warning",
					message: result.message,
					output: result,
				};
			}}
		/>
	);
}
