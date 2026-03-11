import { SpinnerLine, TaskStatusView } from "@mimirmesh/ui";
import { Box, Text, useApp } from "ink";
import { useEffect, useMemo, useState } from "react";

export type CommandOutcome = {
	state: "success" | "warning" | "error";
	message: string;
	details?: Array<{ label: string; value: string }>;
	output?: unknown;
};

type CommandRunnerProps = {
	title: string;
	run: () => Promise<CommandOutcome>;
};

const formatOutput = (output: unknown): string => {
	if (typeof output === "string") {
		return output;
	}
	if (output === undefined) {
		return "";
	}
	return JSON.stringify(output, null, 2);
};

export const CommandRunner = ({ title, run }: CommandRunnerProps) => {
	const { exit } = useApp();
	const [loading, setLoading] = useState(true);
	const [outcome, setOutcome] = useState<CommandOutcome | null>(null);

	useEffect(() => {
		let mounted = true;
		const execute = async () => {
			try {
				const result = await run();
				if (mounted) {
					setOutcome(result);
				}
			} catch (error) {
				if (mounted) {
					setOutcome({
						state: "error",
						message: error instanceof Error ? error.message : String(error),
					});
				}
			} finally {
				if (mounted) {
					setLoading(false);
					setTimeout(() => {
						exit();
					}, 0);
				}
			}
		};
		execute();
		return () => {
			mounted = false;
		};
	}, [run, exit]);

	const detailRows = useMemo(() => outcome?.details ?? [], [outcome]);

	if (loading) {
		return <SpinnerLine label={`${title} in progress`} />;
	}

	if (!outcome) {
		return <TaskStatusView title={title} state="error" message="Command did not produce output." />;
	}

	return (
		<Box flexDirection="column" gap={1}>
			<TaskStatusView
				title={title}
				state={outcome.state}
				message={outcome.message}
				details={detailRows}
			/>
			{outcome.output !== undefined && (
				<Box flexDirection="column">
					<Text dimColor>Output:</Text>
					<Text>{formatOutput(outcome.output)}</Text>
				</Box>
			)}
		</Box>
	);
};
