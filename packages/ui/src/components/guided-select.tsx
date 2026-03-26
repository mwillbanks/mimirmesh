import { Box, Text, useInput } from "ink";
import { useMemo, useRef, useState } from "react";

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
	const initialIndex = Math.max(
		0,
		choices.findIndex((choice) => choice.value === (defaultValue ?? choices[0]?.value)),
	);
	const [focusedIndex, setFocusedIndex] = useState(initialIndex);
	const [selectedValue, setSelectedValue] = useState(defaultValue ?? choices[0]?.value ?? "");
	const focusedIndexRef = useRef(initialIndex);

	const setFocusedChoiceIndex = (nextIndex: number) => {
		focusedIndexRef.current = nextIndex;
		setFocusedIndex(nextIndex);
	};

	const focusedChoice = choices[focusedIndex] ?? choices[0];
	const selectedChoice = useMemo(
		() => choices.find((choice) => choice.value === selectedValue) ?? choices[0],
		[selectedValue, choices],
	);

	useInput((_input, key) => {
		if (!choices.length) {
			return;
		}

		if (key.upArrow) {
			const nextIndex =
				focusedIndexRef.current === 0 ? choices.length - 1 : focusedIndexRef.current - 1;
			setFocusedChoiceIndex(nextIndex);
			return;
		}

		if (key.downArrow) {
			const nextIndex = (focusedIndexRef.current + 1) % choices.length;
			setFocusedChoiceIndex(nextIndex);
			return;
		}

		if (key.return) {
			const nextValue =
				choices[focusedIndexRef.current]?.value ?? focusedChoice?.value ?? selectedValue;
			if (nextValue) {
				setSelectedValue(nextValue);
				onSubmit(nextValue);
			}
			return;
		}

		if (_input === " ") {
			const nextValue = focusedChoice?.value;
			if (nextValue) {
				setSelectedValue(nextValue);
			}
		}
	});

	return (
		<Box flexDirection="column" gap={1}>
			<PromptReason
				title={title}
				reason={reason}
				consequence={consequence}
				nonInteractiveFallback={nonInteractiveFallback}
			/>
			<Box gap={2}>
				<Box flexDirection="column" minWidth={36}>
					{choices.map((choice, index) => {
						const isFocused = index === focusedIndex;
						const isSelected = choice.value === selectedValue;
						return (
							<Text key={choice.value}>
								{isFocused ? ">" : " "} {isSelected ? "[x]" : "[ ]"} {choice.label}
								{choice.recommended ? " (recommended)" : ""}
							</Text>
						);
					})}
				</Box>
				<Box flexDirection="column" flexGrow={1}>
					<Text bold>{focusedChoice?.label ?? "Choice details"}</Text>
					<Text>{focusedChoice ? describeChoice(focusedChoice) : "No choice selected."}</Text>
				</Box>
			</Box>
			<Text>
				<Text bold>Controls:</Text> Use arrow keys to move, press space to mark a choice, and press
				enter to continue with the highlighted option.
			</Text>
			{selectedChoice ? (
				<Text>
					<Text bold>Selected:</Text> {selectedChoice.label}
				</Text>
			) : null}
		</Box>
	);
};
