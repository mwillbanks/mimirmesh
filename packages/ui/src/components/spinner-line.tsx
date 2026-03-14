import { Spinner } from "@inkjs/ui";
import { Text } from "ink";

type SpinnerLineProps = {
	label: string;
	reducedMotion?: boolean;
};

export const SpinnerLine = ({ label, reducedMotion = false }: SpinnerLineProps) =>
	reducedMotion ? <Text>[RUNNING] {label}</Text> : <Spinner label={`[RUNNING] ${label}`} />;
