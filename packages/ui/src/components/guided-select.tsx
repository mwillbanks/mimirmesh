import { Select } from "@inkjs/ui";
import { Box, Text } from "ink";
import { useMemo, useState } from "react";

import type { PromptChoice } from "../workflow/types";
import { PromptReason } from "./prompt-reason";

type GuidedSelectProps = {
	title: string;
	reason: string;
	consequence: string;
	nonInteractiveFallback: string;
	choices: readonly PromptChoice[];
	defaultValue?: string;
	onSubmit: (value: string) => void;
};

const describeChoice = (choice: PromptChoice): string => {
	const prefix = choice.recommended ? "Recommended. " : "";
	return `${prefix}${choice.description ?? "No additional notes."}`;
};

export const GuidedSelect = ({
	title,
	reason,
	consequence,
	nonInteractiveFallback,
	choices,
	defaultValue,
	onSubmit,
}: GuidedSelectProps) => {
	const [selected, setSelected] = useState<string>(defaultValue ?? choices[0]?.value ?? "");

	const selectedChoice = useMemo(
		() => choices.find((choice) => choice.value === selected) ?? choices[0],
		[selected, choices],
	);

	return (
		<Box flexDirection="column" gap={1}>
			<PromptReason
				title={title}
				reason={reason}
				consequence={consequence}
				nonInteractiveFallback={nonInteractiveFallback}
			/>
			<Select
				options={choices.map((choice) => ({
					label: choice.recommended ? `${choice.label} (recommended)` : choice.label,
					value: choice.value,
				}))}
				defaultValue={defaultValue ?? choices[0]?.value}
				onChange={(value) => {
					setSelected(value);
					onSubmit(value);
				}}
			/>
			{selectedChoice ? (
				<Text>
					<Text bold>Selection:</Text> {describeChoice(selectedChoice)}
				</Text>
			) : null}
		</Box>
	);
};
