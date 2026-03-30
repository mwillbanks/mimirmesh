import { Box, Text, useInput } from "ink";
import { useEffect, useMemo, useRef, useState } from "react";

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
	const initialIndex = Math.max(
		0,
		choices.findIndex((choice) => (defaultValues ?? []).includes(choice.value)),
	);
	const [selectedValues, setSelectedValues] = useState<string[]>(defaultValues ?? []);
	const [focusedIndex, setFocusedIndex] = useState(initialIndex === -1 ? 0 : initialIndex);
	const focusedIndexRef = useRef(initialIndex === -1 ? 0 : initialIndex);
	const selectedValuesRef = useRef<string[]>(defaultValues ?? []);

	useEffect(() => {
		const nextIndex = Math.max(
			0,
			choices.findIndex((choice) => (defaultValues ?? []).includes(choice.value)),
		);
		focusedIndexRef.current = nextIndex;
		selectedValuesRef.current = defaultValues ?? [];
		setFocusedIndex(nextIndex);
		setSelectedValues(defaultValues ?? []);
	}, [choices, defaultValues]);

	const setFocusedChoiceIndex = (nextIndex: number) => {
		focusedIndexRef.current = nextIndex;
		setFocusedIndex(nextIndex);
	};

	const focusedChoice = choices[focusedIndex] ?? choices[0];
	const selectedChoices = useMemo(
		() => choices.filter((choice) => selectedValues.includes(choice.value)),
		[choices, selectedValues],
	);

	useInput((input, key) => {
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
			onSubmit(selectedValuesRef.current);
			return;
		}

		if (input === " ") {
			const nextValue = choices[focusedIndexRef.current]?.value ?? focusedChoice?.value;
			if (!nextValue) {
				return;
			}
			setSelectedValues((previous) => {
				const nextValues = previous.includes(nextValue)
					? previous.filter((value) => value !== nextValue)
					: [...previous, nextValue];
				selectedValuesRef.current = nextValues;
				return nextValues;
			});
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
						const isSelected = selectedValues.includes(choice.value);
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
					<Text>{focusedChoice?.description ?? "No choice selected."}</Text>
					<Text>
						<Text bold>Selected:</Text>{" "}
						{selectedChoices.length > 0
							? selectedChoices.map((choice) => choice.label).join(", ")
							: "No items selected."}
					</Text>
				</Box>
			</Box>
			<Text>
				<Text bold>Controls:</Text> Use arrow keys to move, press space to toggle items, and press
				enter to continue.
			</Text>
		</Box>
	);
};
