import { Box, Text, useInput } from "ink";
import { useState } from "react";

import { PromptReason } from "./prompt-reason";

type GuidedTextInputProps = {
	title: string;
	reason: string;
	consequence: string;
	nonInteractiveFallback: string;
	label: string;
	initialValue?: string;
	placeholder?: string;
	mask?: boolean;
	allowEmpty?: boolean;
	hint?: string;
	onSubmit: (value: string) => void;
};

const renderValue = (value: string, options: { mask?: boolean; placeholder?: string }): string => {
	if (!value) {
		return options.placeholder ?? "";
	}
	if (options.mask) {
		return "•".repeat(value.length);
	}
	return value;
};

export const GuidedTextInput = ({
	title,
	reason,
	consequence,
	nonInteractiveFallback,
	label,
	initialValue = "",
	placeholder,
	mask = false,
	allowEmpty = false,
	hint,
	onSubmit,
}: GuidedTextInputProps) => {
	const [value, setValue] = useState(initialValue);
	const [error, setError] = useState<string | null>(null);

	useInput((input, key) => {
		if (key.return) {
			const nextValue = allowEmpty ? value : value.trim();
			if (!allowEmpty && nextValue.length === 0) {
				setError(`${label} is required.`);
				return;
			}
			setError(null);
			onSubmit(nextValue);
			return;
		}

		if (key.backspace || key.delete) {
			setValue((previous) => previous.slice(0, -1));
			setError(null);
			return;
		}

		if (key.ctrl || key.meta || key.tab || key.escape) {
			return;
		}

		if (input.length > 0) {
			setValue((previous) => previous + input);
			setError(null);
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
			<Text>
				<Text bold>{label}:</Text> {renderValue(value, { mask, placeholder }) || " "}
			</Text>
			{hint ? <Text>{hint}</Text> : null}
			<Text>
				<Text bold>Controls:</Text> Type to edit, backspace to delete, and press enter to continue.
			</Text>
			{error ? (
				<Text color="red">
					<Text bold>Error:</Text> {error}
				</Text>
			) : null}
		</Box>
	);
};
