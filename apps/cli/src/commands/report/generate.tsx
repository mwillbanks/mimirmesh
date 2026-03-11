import { CommandRunner } from "../../lib/command-runner";
import { generateReports, loadCliContext } from "../../lib/context";

export default function ReportGenerateCommand() {
	return (
		<CommandRunner
			title="Generate Reports"
			run={async () => {
				const context = await loadCliContext();
				const reports = await generateReports(context);
				return {
					state: "success",
					message: `Generated ${reports.length} report(s).`,
					output: reports,
				};
			}}
		/>
	);
}
