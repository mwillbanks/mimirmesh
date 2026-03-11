import { argument } from "pastel";
import zod from "zod";

import { CommandRunner } from "../../lib/command-runner";
import { loadCliContext, searchNotes } from "../../lib/context";

export const args = zod.tuple([
	zod.string().describe(argument({ name: "query", description: "Query to search within notes" })),
]);

type Props = {
	args: zod.infer<typeof args>;
};

export default function NoteSearchCommand({ args }: Props) {
	const [query] = args;
	return (
		<CommandRunner
			title="Search Notes"
			run={async () => {
				const context = await loadCliContext();
				const matches = await searchNotes(context, query);
				return {
					state: "success",
					message: `Found ${matches.length} match(es).`,
					output: matches,
				};
			}}
		/>
	);
}
