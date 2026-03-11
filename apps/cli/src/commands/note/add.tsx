import { argument } from "pastel";
import zod from "zod";

import { CommandRunner } from "../../lib/command-runner";
import { addNote, loadCliContext } from "../../lib/context";

export const args = zod.tuple([
	zod.string().describe(argument({ name: "title", description: "Note title" })),
	zod.string().describe(argument({ name: "content", description: "Note content" })),
]);

type Props = {
	args: zod.infer<typeof args>;
};

export default function NoteAddCommand({ args }: Props) {
	const [title, content] = args;
	return (
		<CommandRunner
			title="Add Note"
			run={async () => {
				const context = await loadCliContext();
				const note = await addNote(context, title, content);
				return {
					state: "success",
					message: "Note saved.",
					details: [{ label: "Path", value: note.path }],
				};
			}}
		/>
	);
}
