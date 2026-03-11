import { CommandRunner } from "../../lib/command-runner";
import { loadCliContext, mcpListTools } from "../../lib/context";

export default function McpListToolsCommand() {
	return (
		<CommandRunner
			title="List MCP Tools"
			run={async () => {
				const context = await loadCliContext();
				const tools = await mcpListTools(context);
				return {
					state: "success",
					message: `Discovered ${tools.length} MCP tools.`,
					output: tools,
				};
			}}
		/>
	);
}
