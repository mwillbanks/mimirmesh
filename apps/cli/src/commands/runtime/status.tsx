import { CommandRunner } from "../../lib/command-runner";
import { loadCliContext, runtimeAction } from "../../lib/context";

export default function RuntimeStatusCommand() {
	return (
		<CommandRunner
			title="Runtime Status"
			run={async () => {
				const context = await loadCliContext();
				const result = await runtimeAction(context, "status");
				return {
					state: result.ok ? "success" : "warning",
					message: result.message,
					details: [
						{
							label: "Runtime version",
							value: result.runtimeVersion?.runtimeVersion ?? "unknown",
						},
						{
							label: "Schema version",
							value: String(result.runtimeVersion?.runtimeSchemaVersion ?? "unknown"),
						},
						{
							label: "Health",
							value: result.health.state,
						},
						{
							label: "Migration status",
							value: result.health.migrationStatus ?? "none",
						},
					],
					output: result,
				};
			}}
		/>
	);
}
