import zod from "zod";

import { CommandRunner } from "../../lib/command-runner";
import { configGet, loadCliContext } from "../../lib/context";

export const options = zod.object({
	path: zod.string().optional().describe("Dot path inside config (defaults to full config)"),
});

type Props = {
	options: zod.infer<typeof options>;
};

export default function ConfigGetCommand({ options }: Props) {
	return (
		<CommandRunner
			title="Read Configuration"
			run={async () => {
				const context = await loadCliContext();
				const value = await configGet(context, options.path ?? "");
				return {
					state: "success",
					message: options.path
						? `Read config path ${options.path}`
						: "Read full project configuration.",
					output: value,
				};
			}}
		/>
	);
}
