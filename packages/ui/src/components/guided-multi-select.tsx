import { MultiSelect } from "@inkjs/ui";
import { Box, Text } from "ink";
import { useState } from "react";

import type { PromptChoice } from "../workflow/types";
import { PromptReason } from "./prompt-reason";

type GuidedMultiSelectProps = {
	title: string;
	reason: string;
	consequence: string;
	nonInteractiveFallback: string;
	choices: readonly PromptChoice[];
	defaultValues?: string[];
	onSubmit: (values: string[]) => void;
};

export const GuidedMultiSelect = ({
	title,
	reason,
	consequence,
	nonInteractiveFallback,
	choices,
	defaultValues,
	onSubmit,
}: GuidedMultiSelectProps) => {
	const [selectedValues, setSelectedValues] = useState<string[]>(defaultValues ?? []);
	const selectedChoices = choices.filter((choice) => selectedValues.includes(choice.value));

	return (
		<Box flexDirection="column" gap={1}>
			<PromptReason
				title={title}
				reason={reason}
				consequence={consequence}
				nonInteractiveFallback={nonInteractiveFallback}
			/>
			<MultiSelect
				options={choices.map((choice) => ({
					label: choice.recommended ? `${choice.label} (recommended)` : choice.label,
					value: choice.value,
				}))}
				defaultValue={defaultValues}
				onChange={(values) => {
					setSelectedValues(values);
				}}
				onSubmit={(values) => {
					setSelectedValues(values);
					onSubmit(values);
				}}
			/>
			<Text>
				<Text bold>Selected:</Text>{" "}
				{selectedChoices.length > 0
					? selectedChoices.map((choice) => choice.label).join(", ")
					: "No skills selected."}
			</Text>
		</Box>
	);
};
