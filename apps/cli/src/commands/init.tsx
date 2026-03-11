import zod from "zod";

import { CommandRunner } from "../lib/command-runner";
import { initializeProject, installIde, loadCliContext } from "../lib/context";

export const options = zod.object({
	ide: zod
		.enum(["vscode", "cursor", "claude", "codex"])
		.optional()
		.describe("Optional IDE/agent target to configure during init"),
});

type Props = {
	options: zod.infer<typeof options>;
};

export default function InitCommand({ options }: Props) {
	return (
		<CommandRunner
			title="Initialize MímirMesh"
			run={async () => {
				const context = await loadCliContext();
				const result = await initializeProject(context);
				const details = [
					{ label: "Repo shape", value: result.analysis.shape },
					{ label: "Runtime", value: result.runtimeMessage },
					{ label: "Reports", value: String(result.reports.length) },
					{ label: "Spec Kit", value: result.specKit.ready ? "ready" : "needs setup" },
				];
				if (options.ide) {
					const ide = await installIde(context, options.ide);
					details.push({ label: "IDE config", value: ide.configPath });
				}
				return {
					state: result.specKit.ready ? "success" : "warning",
					message:
						"Initialization complete. Runtime, config, reports, and engine orchestration are ready.",
					details,
					output: {
						reports: result.reports,
						next: options.ide
							? "IDE integration installed"
							: "Run `mimirmesh install ide` to add IDE MCP config",
					},
				};
			}}
		/>
	);
}
