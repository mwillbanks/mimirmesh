import { argument } from "pastel";
import zod from "zod";

import { CommandRunner } from "../../lib/command-runner";
import { configDisableEngine, loadCliContext } from "../../lib/context";

const engineSchema = zod.enum([
	"codebase-memory-mcp",
	"srclight",
	"document-mcp",
	"mcp-adr-analysis-server",
]);

export const args = zod.tuple([
	engineSchema.describe(argument({ name: "engine", description: "Engine id to disable" })),
]);

type Props = {
	args: zod.infer<typeof args>;
};

export default function ConfigDisableCommand({ args }: Props) {
	const [engine] = args;
	return (
		<CommandRunner
			title="Disable Engine"
			run={async () => {
				const context = await loadCliContext();
				await configDisableEngine(context, engine);
				return {
					state: "success",
					message: `Disabled engine ${engine}`,
				};
			}}
		/>
	);
}
