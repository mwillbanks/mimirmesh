import { CommandRunner } from "../../lib/command-runner";
import { loadCliContext, runtimeDoctor } from "../../lib/context";

export default function RuntimeDoctorCommand() {
	return (
		<CommandRunner
			title="Runtime Doctor"
			run={async () => {
				const context = await loadCliContext();
				const result = await runtimeDoctor(context);
				return {
					state: result.warnings.length === 0 ? "success" : "warning",
					message:
						result.warnings.length === 0
							? "Runtime validation passed."
							: "Runtime validation found degraded preserved assets.",
					output: result,
				};
			}}
		/>
	);
}
