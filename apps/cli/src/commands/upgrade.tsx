import { CommandRunner } from "../lib/command-runner";
import { loadCliContext, runtimeUpgradeMigrate } from "../lib/context";

export default function UpgradeCommand() {
	return (
		<CommandRunner
			title="Upgrade Runtime"
			run={async () => {
				const context = await loadCliContext();
				const result = await runtimeUpgradeMigrate(context);
				return {
					state:
						result.outcome?.result === "success"
							? "success"
							: result.outcome?.result === "blocked" || result.outcome?.result === "failed"
								? "error"
								: "warning",
					message: result.message,
					output: result,
				};
			}}
		/>
	);
}
