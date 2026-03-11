import { argument } from "pastel";
import zod from "zod";

import { CommandRunner } from "../../lib/command-runner";
import { addDocument, loadCliContext } from "../../lib/context";

export const args = zod.tuple([
	zod.string().describe(argument({ name: "path", description: "Path to document to ingest" })),
]);

type Props = {
	args: zod.infer<typeof args>;
};

export default function DocumentAddCommand({ args }: Props) {
	const [path] = args;
	return (
		<CommandRunner
			title="Add Document"
			run={async () => {
				const context = await loadCliContext();
				const result = await addDocument(context, path);
				return {
					state: "success",
					message: "Document added to local memory store.",
					details: [{ label: "Stored", value: result.copiedTo }],
				};
			}}
		/>
	);
}
