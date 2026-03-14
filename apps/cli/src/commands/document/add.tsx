import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import { argument } from "pastel";
import zod from "zod/v4";

import { CommandRunner } from "../../lib/command-runner";
import { addDocument } from "../../lib/context";
import { createContextWorkflow } from "../../lib/context-workflow";
import { resolvePresentationProfile, withPresentationOptions } from "../../lib/presentation";

export const args = zod.tuple([
	zod.string().describe(argument({ name: "path", description: "Path to document to ingest" })),
]);

export const options = withPresentationOptions({}, { allowNonInteractive: true });

type Props = {
	args: zod.infer<typeof args>;
	options: zod.infer<typeof options>;
	presentation?: PresentationProfile;
	exitOnComplete?: boolean;
	onComplete?: (state: WorkflowRunState) => void;
};

export default function DocumentAddCommand({
	args,
	options,
	presentation,
	exitOnComplete,
	onComplete,
}: Props) {
	const [path] = args;
	return (
		<CommandRunner
			definition={createContextWorkflow({
				id: "document-add",
				title: "Add Document",
				description: "Copy an external document into the project-local MímirMesh memory store.",
				category: "notes",
				interactivePolicy: "default-interactive",
				recommendedNextActions: ["note-list", "report-generate"],
				stepLabel: "Add document",
				stepKind: "generation",
				run: async (context) => {
					const result = await addDocument(context, path);
					return {
						kind: "success",
						message: "Document added to the local memory store.",
						impact:
							"The requested document is now stored under `.mimirmesh/memory/documents` for local-first workflows.",
						nextAction:
							"Inspect the stored path or add a related note if the document needs follow-up.",
						evidence: [
							{ label: "Source", value: path },
							{ label: "Stored", value: result.copiedTo },
						],
						machineReadablePayload: result,
					};
				},
			})}
			presentation={presentation ?? resolvePresentationProfile(options)}
			exitOnComplete={exitOnComplete}
			onComplete={onComplete}
		/>
	);
}
