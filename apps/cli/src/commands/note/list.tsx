import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import type zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { listNotes } from "../../lib/context";
import { createContextWorkflow } from "../../lib/context-workflow";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";

export const options = withPresentationOptions({});

type Props = {
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function NoteListCommand({
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	return (
		<CommandRunner
			definition={createContextWorkflow({
				id: "note-list",
				title: "List Notes",
				description: "List project-local note files tracked in the MímirMesh memory directory.",
				category: "notes",
				interactivePolicy: "default-non-interactive",
				recommendedNextActions: ["note-add", "note-search"],
				stepLabel: "List notes",
				stepKind: "discovery",
				run: async (context) => {
					const notes = await listNotes(context);
					return {
						kind: "success",
						message: `Found ${notes.length} note(s).`,
						impact: "Project-local notes are available for review or follow-up search.",
						nextAction:
							notes.length > 0
								? "Run `mimirmesh note search <query>` to search within notes."
								: "Run `mimirmesh note add <title> <content>` to create the first note.",
						evidence: [
							{ label: "Note count", value: String(notes.length) },
							...notes.slice(0, 8).map((note, index) => ({
								label: `Note ${index + 1}`,
								value: note,
							})),
						],
						machineReadablePayload: { notes },
					};
				},
			})}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
