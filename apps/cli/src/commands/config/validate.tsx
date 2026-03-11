import { CommandRunner } from "../../lib/command-runner";
import { configValidate, loadCliContext } from "../../lib/context";

export default function ConfigValidateCommand() {
	return (
		<CommandRunner
			title="Validate Configuration"
			run={async () => {
				const context = await loadCliContext();
				const validation = await configValidate(context);
				return {
					state: validation.ok ? "success" : "error",
					message: validation.ok
						? "Config file is valid."
						: "Config file contains validation errors.",
					output: validation.errors,
				};
			}}
		/>
	);
}
