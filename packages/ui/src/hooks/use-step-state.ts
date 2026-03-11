import { useCallback, useState } from "react";

import type { TaskState } from "../patterns/task-status-view";

export type StepState = {
	state: TaskState;
	message: string;
};

export const useStepState = (initialMessage: string): [StepState, (next: StepState) => void] => {
	const [stepState, setStepState] = useState<StepState>({
		state: "idle",
		message: initialMessage,
	});
	const update = useCallback((next: StepState) => {
		setStepState(next);
	}, []);
	return [stepState, update];
};
