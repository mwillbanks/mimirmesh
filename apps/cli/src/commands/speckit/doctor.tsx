import { CommandRunner } from "../../lib/command-runner";
import { loadCliContext, speckitDoctor } from "../../lib/context";

export default function SpeckitDoctorCommand() {
	return (
		<CommandRunner
			title="Spec Kit Doctor"
			run={async () => {
				const context = await loadCliContext();
				const result = await speckitDoctor(context);
				return {
					state: result.ready ? "success" : "warning",
					message: result.ready
						? "Spec Kit readiness checks passed."
						: "Spec Kit readiness checks failed.",
					output: result.findings,
				};
			}}
		/>
	);
}
