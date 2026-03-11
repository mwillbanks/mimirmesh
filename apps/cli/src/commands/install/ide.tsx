import { Select } from "@inkjs/ui";
import { Box, Text } from "ink";
import { useState } from "react";
import zod from "zod";

import { CommandRunner } from "../../lib/command-runner";
import { installIde, loadCliContext } from "../../lib/context";

export const options = zod.object({
	target: zod.enum(["vscode", "cursor", "claude", "codex"]).optional(),
	serverCommand: zod.string().optional().describe("Override MCP server command"),
});

type Props = {
	options: zod.infer<typeof options>;
};

const targets = [
	{ label: "VS Code", value: "vscode" },
	{ label: "Cursor", value: "cursor" },
	{ label: "Claude", value: "claude" },
	{ label: "Codex", value: "codex" },
] as const;

export default function InstallIdeCommand({ options }: Props) {
	const [selected, setSelected] = useState<string | null>(options.target ?? null);

	if (!selected) {
		return (
			<Box flexDirection="column">
				<Text bold>Select IDE/agent target</Text>
				<Select
					options={targets.map((target) => ({ label: target.label, value: target.value }))}
					onChange={(value) => {
						setSelected(value);
					}}
				/>
			</Box>
		);
	}

	return (
		<CommandRunner
			title="Install IDE MCP Integration"
			run={async () => {
				const context = await loadCliContext();
				const result = await installIde(
					context,
					selected as "vscode" | "cursor" | "claude" | "codex",
					options.serverCommand,
				);
				return {
					state: "success",
					message: `Installed MCP configuration for ${selected}.`,
					details: [
						{ label: "Config", value: result.configPath },
						{ label: "Command", value: result.serverCommand },
						{
							label: "Args",
							value: result.serverArgs.length > 0 ? result.serverArgs.join(" ") : "(none)",
						},
					],
				};
			}}
		/>
	);
}
