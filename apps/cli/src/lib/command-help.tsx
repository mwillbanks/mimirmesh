import { Box, Text, useApp } from "ink";
import { useEffect } from "react";

export type CommandHelpFlag = {
	flag: string;
	description: string;
};

export type CommandHelpSection = {
	title: string;
	lines: string[];
};

export type CommandHelpDefinition = {
	title: string;
	usage: string;
	flags: readonly CommandHelpFlag[];
	sections?: readonly CommandHelpSection[];
	examples?: readonly string[];
};

export const formatCommandHelpLines = (definition: CommandHelpDefinition): string[] => [
	definition.title,
	`Usage: ${definition.usage}`,
	"",
	"Available flags",
	...definition.flags.map((row) => `  ${row.flag}  ${row.description}`),
	...(definition.sections ?? []).flatMap((section) => [
		"",
		section.title,
		...section.lines.map((line) => `  ${line}`),
	]),
	...(definition.examples && definition.examples.length > 0
		? ["", "Examples", ...definition.examples.map((example) => `  ${example}`)]
		: []),
];

export const CommandHelpView = ({ definition }: { definition: CommandHelpDefinition }) => {
	const { exit } = useApp();

	useEffect(() => {
		exit();
	}, [exit]);

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>{definition.title}</Text>
			<Text>Usage: {definition.usage}</Text>
			<Text bold>Available flags</Text>
			{definition.flags.map((row) => (
				<Text key={row.flag}>
					<Text bold>{row.flag}</Text> {row.description}
				</Text>
			))}
			{definition.sections?.map((section) => (
				<Box key={section.title} flexDirection="column">
					<Text bold>{section.title}</Text>
					{section.lines.map((line) => (
						<Text key={`${section.title}:${line}`}>{line}</Text>
					))}
				</Box>
			))}
			{definition.examples?.length ? (
				<Box flexDirection="column">
					<Text bold>Examples</Text>
					{definition.examples.map((example) => (
						<Text key={example}>{example}</Text>
					))}
				</Box>
			) : null}
		</Box>
	);
};
