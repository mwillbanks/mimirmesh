import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import { argument } from "pastel";
import zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { addNote } from "../../lib/context";
import { createContextWorkflow } from "../../lib/context-workflow";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";

export const args = zod.tuple([
	zod.string().describe(argument({ name: "title", description: "Note title" })),
	zod.string().describe(argument({ name: "content", description: "Note content" })),
]);

export const options = withPresentationOptions({}, { allowNonInteractive: true });

type Props = {
	args: zod.infer<typeof args>;
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function NoteAddCommand({
	args,
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const [title, content] = args;
	return (
		<CommandRunner
			definition={createContextWorkflow({
				id: "note-add",
				title: "Add Note",
				description: "Write a new project-local note into the MímirMesh memory directory.",
				category: "notes",
				interactivePolicy: "default-interactive",
				recommendedNextActions: ["note-list", "note-search"],
				stepLabel: "Write note",
				stepKind: "generation",
				run: async (context) => {
					const note = await addNote(context, title, content);
					return {
						kind: "success",
						message: "Note saved.",
						impact: "The new note is now stored in the project-local memory directory.",
						nextAction:
							"Run `mimirmesh note list` or `mimirmesh note search <query>` to inspect the note store.",
						evidence: [
							{ label: "Title", value: title },
							{ label: "Path", value: note.path },
						],
						machineReadablePayload: note,
					};
				},
			})}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
