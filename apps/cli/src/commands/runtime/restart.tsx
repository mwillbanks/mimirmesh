import { CommandRunner } from "../../lib/command-runner";
import { loadCliContext, runtimeAction } from "../../lib/context";

export default function RuntimeRestartCommand() {
	return (
		<CommandRunner
			title="Restart Runtime"
			run={async () => {
				const context = await loadCliContext();
				const result = await runtimeAction(context, "restart");
				return {
					state: result.ok ? "success" : "warning",
					message: result.message,
					output: result.health,
				};
			}}
		/>
	);
}
