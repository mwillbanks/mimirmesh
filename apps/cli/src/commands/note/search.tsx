import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import { argument } from "pastel";
import zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { searchNotes } from "../../lib/context";
import { createContextWorkflow } from "../../lib/context-workflow";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";

export const args = zod.tuple([
	zod.string().describe(argument({ name: "query", description: "Query to search within notes" })),
]);

export const options = withPresentationOptions({});

type Props = {
	args: zod.infer<typeof args>;
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function NoteSearchCommand({
	args,
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const [query] = args;
	return (
		<CommandRunner
			definition={createContextWorkflow({
				id: "note-search",
				title: "Search Notes",
				description: "Search the project-local note store for the requested query.",
				category: "notes",
				interactivePolicy: "default-non-interactive",
				recommendedNextActions: ["note-list", "note-add"],
				stepLabel: "Search notes",
				stepKind: "discovery",
				run: async (context) => {
					const matches = await searchNotes(context, query);
					return {
						kind: "success",
						message: `Found ${matches.length} match(es).`,
						impact: "Matching note content is now visible for review.",
						nextAction:
							matches.length > 0
								? "Inspect the matched note paths above or refine the query."
								: "Try a broader query or add a new note.",
						evidence: [
							{ label: "Query", value: query },
							{ label: "Matches", value: String(matches.length) },
							...matches.slice(0, 8).map((match, index) => ({
								label: `Match ${index + 1}`,
								value: match,
							})),
						],
						machineReadablePayload: { query, matches },
					};
				},
			})}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
