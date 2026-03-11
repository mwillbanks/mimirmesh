import { CommandRunner } from "../lib/command-runner";
import { loadCliContext, refreshProject } from "../lib/context";

export default function RefreshCommand() {
	return (
		<CommandRunner
			title="Refresh Indexes and Reports"
			run={async () => {
				const context = await loadCliContext();
				const result = await refreshProject(context);
				return {
					state: "success",
					message: "Refresh completed.",
					details: [
						{ label: "Runtime", value: result.runtimeMessage },
						{ label: "Reports", value: String(result.reports.length) },
					],
					output: result.reports,
				};
			}}
		/>
	);
}
