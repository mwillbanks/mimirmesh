import { CommandRunner } from "../../../lib/command-runner";
import { loadCliContext, runtimeUpgradeStatus } from "../../../lib/context";

export default function RuntimeUpgradeStatusCommand() {
	return (
		<CommandRunner
			title="Runtime Upgrade Status"
			run={async () => {
				const context = await loadCliContext();
				const result = await runtimeUpgradeStatus(context);
				const state =
					result.report.state === "current"
						? "success"
						: result.report.state === "blocked"
							? "error"
							: "warning";
				return {
					state,
					message: `Runtime upgrade state: ${result.report.state}.`,
					output: result,
				};
			}}
		/>
	);
}
