import { CommandRunner } from "../../../lib/command-runner";
import { loadCliContext, runtimeUpgradeStatus } from "../../../lib/context";

export default function RuntimeUpgradeIndexCommand() {
	return (
		<CommandRunner
			title="Runtime Upgrade"
			run={async () => {
				const context = await loadCliContext();
				const result = await runtimeUpgradeStatus(context);
				return {
					state: result.report.state === "current" ? "success" : "warning",
					message: `Runtime upgrade state: ${result.report.state}.`,
					output: result,
				};
			}}
		/>
	);
}
