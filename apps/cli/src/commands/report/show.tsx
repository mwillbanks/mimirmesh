import { argument } from "pastel";
import zod from "zod";

import { CommandRunner } from "../../lib/command-runner";
import { loadCliContext, showReport } from "../../lib/context";

export const args = zod.tuple([
	zod
		.string()
		.describe(
			argument({ name: "name", description: "Report filename (example: project-summary.md)" }),
		),
]);

type Props = {
	args: zod.infer<typeof args>;
};

export default function ReportShowCommand({ args }: Props) {
	const [name] = args;
	return (
		<CommandRunner
			title="Show Report"
			run={async () => {
				const context = await loadCliContext();
				const content = await showReport(context, name);
				return {
					state: "success",
					message: `Loaded report ${name}.`,
					output: content,
				};
			}}
		/>
	);
}
