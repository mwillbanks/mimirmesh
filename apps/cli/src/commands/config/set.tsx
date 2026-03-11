import { argument } from "pastel";
import zod from "zod";

import { CommandRunner } from "../../lib/command-runner";
import { configSet, loadCliContext } from "../../lib/context";

export const args = zod.tuple([
	zod
		.string()
		.describe(
			argument({ name: "path", description: "Dot path in config (example: logging.level)" }),
		),
	zod
		.string()
		.describe(argument({ name: "value", description: "New value for the provided path" })),
]);

type Props = {
	args: zod.infer<typeof args>;
};

export default function ConfigSetCommand({ args }: Props) {
	const [path, value] = args;
	return (
		<CommandRunner
			title="Update Configuration"
			run={async () => {
				const context = await loadCliContext();
				await configSet(context, path, value);
				return {
					state: "success",
					message: `Updated config path ${path}`,
					details: [{ label: "Value", value }],
				};
			}}
		/>
	);
}
