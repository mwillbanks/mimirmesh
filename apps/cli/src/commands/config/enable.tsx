import { argument } from "pastel";
import zod from "zod";

import { CommandRunner } from "../../lib/command-runner";
import { configEnableEngine, loadCliContext } from "../../lib/context";

const engineSchema = zod.enum([
	"codebase-memory-mcp",
	"srclight",
	"document-mcp",
	"mcp-adr-analysis-server",
]);

export const args = zod.tuple([
	engineSchema.describe(argument({ name: "engine", description: "Engine id to enable" })),
]);

type Props = {
	args: zod.infer<typeof args>;
};

export default function ConfigEnableCommand({ args }: Props) {
	const [engine] = args;
	return (
		<CommandRunner
			title="Enable Engine"
			run={async () => {
				const context = await loadCliContext();
				await configEnableEngine(context, engine);
				return {
					state: "success",
					message: `Enabled engine ${engine}`,
				};
			}}
		/>
	);
}
