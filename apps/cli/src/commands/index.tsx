import { CommandRunner } from "../lib/command-runner";
import { collectInitSignals, loadCliContext } from "../lib/context";

export const isDefault = true;

export default function IndexCommand() {
	return (
		<CommandRunner
			title="MímirMesh Status"
			run={async () => {
				const context = await loadCliContext();
				const signals = await collectInitSignals(context);
				return {
					state: "success",
					message: "MímirMesh is ready. Use subcommands for init/runtime/mcp/report flows.",
					details: [
						{ label: "Project", value: context.projectRoot },
						{ label: "Repo shape", value: signals.analysis.shape },
						{ label: "Config", value: signals.configPath },
						{ label: "Files", value: String(signals.fileCount) },
					],
				};
			}}
		/>
	);
}
