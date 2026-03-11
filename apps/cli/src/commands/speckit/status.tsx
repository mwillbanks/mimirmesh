import { CommandRunner } from "../../lib/command-runner";
import { loadCliContext, speckitStatus } from "../../lib/context";

export default function SpeckitStatusCommand() {
	return (
		<CommandRunner
			title="Spec Kit Status"
			run={async () => {
				const context = await loadCliContext();
				const status = await speckitStatus(context);
				return {
					state: status.ready ? "success" : "warning",
					message: status.ready ? "Spec Kit is ready." : "Spec Kit readiness is incomplete.",
					output: status,
				};
			}}
		/>
	);
}
