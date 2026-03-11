import { CommandRunner } from "../lib/command-runner";
import { loadCliContext, setupProject } from "../lib/context";

export default function SetupCommand() {
	return (
		<CommandRunner
			title="Scaffold Docs and Guidance"
			run={async () => {
				const context = await loadCliContext();
				const directories = await setupProject(context);
				return {
					state: "success",
					message: "Non-destructive scaffolding completed.",
					details: [{ label: "Directories ensured", value: String(directories.length) }],
					output: directories,
				};
			}}
		/>
	);
}
