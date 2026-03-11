import zod from "zod";

import { CommandRunner } from "../lib/command-runner";
import { applyUpdate, loadCliContext, updateCheck } from "../lib/context";

export const options = zod.object({
	check: zod.boolean().default(false).describe("Check for updates without applying"),
});

type Props = {
	options: zod.infer<typeof options>;
};

export default function UpdateCommand({ options }: Props) {
	return (
		<CommandRunner
			title="Update MímirMesh"
			run={async () => {
				const context = await loadCliContext();
				const check = await updateCheck(context);
				if (options.check) {
					return {
						state: check.updateAvailable ? "warning" : "success",
						message: check.updateAvailable
							? `Update available: ${check.latestVersion}`
							: "No updates available.",
						output: check,
					};
				}

				const updateResult = await applyUpdate(context);
				return {
					state: updateResult.applied ? "success" : "warning",
					message: updateResult.details,
					output: check,
				};
			}}
		/>
	);
}
