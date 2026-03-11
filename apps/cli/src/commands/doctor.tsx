import { CommandRunner } from "../lib/command-runner";
import { doctorProject, loadCliContext } from "../lib/context";

export default function DoctorCommand() {
	return (
		<CommandRunner
			title="Run Diagnostics"
			run={async () => {
				const context = await loadCliContext();
				const result = await doctorProject(context);
				return {
					state: result.status === "healthy" ? "success" : "warning",
					message:
						result.status === "healthy" ? "No issues detected." : "Doctor found actionable issues.",
					output: result.issues,
				};
			}}
		/>
	);
}
