import { CommandRunner } from "../../../lib/command-runner";
import { loadCliContext, runtimeUpgradeRepair } from "../../../lib/context";

export default function RuntimeUpgradeRepairCommand() {
	return (
		<CommandRunner
			title="Repair Runtime"
			run={async () => {
				const context = await loadCliContext();
				const result = await runtimeUpgradeRepair(context);
				return {
					state:
						result.outcome?.result === "success"
							? "success"
							: result.outcome?.result === "blocked"
								? "error"
								: "warning",
					message: result.message,
					output: result,
				};
			}}
		/>
	);
}
