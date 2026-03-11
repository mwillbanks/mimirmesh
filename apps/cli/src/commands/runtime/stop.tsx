import { CommandRunner } from "../../lib/command-runner";
import { loadCliContext, runtimeAction } from "../../lib/context";

export default function RuntimeStopCommand() {
	return (
		<CommandRunner
			title="Stop Runtime"
			run={async () => {
				const context = await loadCliContext();
				const result = await runtimeAction(context, "stop");
				return {
					state: "success",
					message: result.message,
					output: result.health,
				};
			}}
		/>
	);
}
