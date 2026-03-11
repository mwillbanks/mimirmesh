import { Spinner } from "@inkjs/ui";

type SpinnerLineProps = {
	label: string;
};

export const SpinnerLine = ({ label }: SpinnerLineProps) => <Spinner label={label} />;
