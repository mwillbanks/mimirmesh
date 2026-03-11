import { CommandRunner } from "../../lib/command-runner";
import { loadCliContext, runtimeAction } from "../../lib/context";

export default function RuntimeRefreshCommand() {
	return (
		<CommandRunner
			title="Refresh Runtime"
			run={async () => {
				const context = await loadCliContext();
				const result = await runtimeAction(context, "refresh");
				return {
					state: result.ok ? "success" : "warning",
					message: result.message,
					output: result,
				};
			}}
		/>
	);
}
