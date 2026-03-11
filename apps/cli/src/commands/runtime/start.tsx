import { CommandRunner } from "../../lib/command-runner";
import { loadCliContext, runtimeAction } from "../../lib/context";

export default function RuntimeStartCommand() {
	return (
		<CommandRunner
			title="Start Runtime"
			run={async () => {
				const context = await loadCliContext();
				const result = await runtimeAction(context, "start");
				return {
					state: result.ok ? "success" : "warning",
					message: result.message,
					output: result.health,
				};
			}}
		/>
	);
}
