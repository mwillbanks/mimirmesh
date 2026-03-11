import { CommandRunner } from "../../lib/command-runner";
import { listNotes, loadCliContext } from "../../lib/context";

export default function NoteListCommand() {
	return (
		<CommandRunner
			title="List Notes"
			run={async () => {
				const context = await loadCliContext();
				const notes = await listNotes(context);
				return {
					state: "success",
					message: `Found ${notes.length} note(s).`,
					output: notes,
				};
			}}
		/>
	);
}
