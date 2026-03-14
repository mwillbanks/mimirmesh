import { Box, Text } from "ink";

import type { TerminalOutcome as TerminalOutcomeModel } from "../workflow/types";
import { StateMessage } from "./state-message";

type TerminalOutcomeProps = {
	outcome: TerminalOutcomeModel;
};

export const TerminalOutcome = ({ outcome }: TerminalOutcomeProps) => (
	<Box flexDirection="column" gap={1}>
		<Text bold>Terminal outcome</Text>
		<StateMessage variant={outcome.kind}>{outcome.message}</StateMessage>
		<Text>
			<Text bold>Impact:</Text> {outcome.impact}
		</Text>
		{outcome.completedWork.length > 0 ? (
			<Box flexDirection="column">
				<Text bold>Completed work</Text>
				{outcome.completedWork.map((item) => (
					<Text key={item}>- {item}</Text>
				))}
			</Box>
		) : null}
		{outcome.blockedCapabilities.length > 0 ? (
			<Box flexDirection="column">
				<Text bold>Blocked capability</Text>
				{outcome.blockedCapabilities.map((item) => (
					<Text key={item}>- {item}</Text>
				))}
			</Box>
		) : null}
		{outcome.evidence?.length ? (
			<Box flexDirection="column">
				<Text bold>Observed evidence</Text>
				{outcome.evidence.map((row) => (
					<Text key={`${row.label}-${row.value}`}>
						{row.label}: {row.value}
					</Text>
				))}
			</Box>
		) : null}
		<Text>
			<Text bold>Next action:</Text> {outcome.nextAction}
		</Text>
	</Box>
);
