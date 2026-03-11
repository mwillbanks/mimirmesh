import { CommandRunner } from "../../lib/command-runner";
import { loadCliContext, speckitInit } from "../../lib/context";

export default function SpeckitInitCommand() {
	return (
		<CommandRunner
			title="Initialize Spec Kit"
			run={async () => {
				const context = await loadCliContext();
				const result = await speckitInit(context);
				return {
					state: result.initialized ? "success" : "warning",
					message: result.initialized
						? "Spec Kit initialization signals are present."
						: "Spec Kit initialization needs additional setup.",
					output: result,
				};
			}}
		/>
	);
}
