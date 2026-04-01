import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import { Box, Text } from "ink";

type SkillFindItem = {
	id: string;
	title: string;
	content: string;
	score: number;
};

const truncateCell = (value: string, width: number): string => {
	if (value.length <= width) {
		return value.padEnd(width, " ");
	}

	if (width <= 3) {
		return value.slice(0, width);
	}

	return `${value.slice(0, width - 3)}...`;
};

const extractItems = (state: WorkflowRunState): SkillFindItem[] => {
	const payload = state.outcome?.machineReadablePayload;
	if (!payload || typeof payload !== "object") {
		return [];
	}

	const tool = "tool" in payload ? payload.tool : undefined;
	const result = "result" in payload ? payload.result : undefined;
	if (tool !== "skills.find" || !result || typeof result !== "object") {
		return [];
	}

	const items = "items" in result ? result.items : undefined;
	if (!Array.isArray(items)) {
		return [];
	}

	return items.flatMap((item) => {
		if (!item || typeof item !== "object") {
			return [];
		}

		const id = "id" in item && typeof item.id === "string" ? item.id : "";
		const title = "title" in item && typeof item.title === "string" ? item.title : "";
		const content = "content" in item && typeof item.content === "string" ? item.content : "";
		const score = "score" in item && typeof item.score === "number" ? item.score : 0;

		if (!id || !title) {
			return [];
		}

		return [{ id, title, content, score }];
	});
};

const columnWidths = (items: SkillFindItem[], presentation: PresentationProfile) => {
	const nameMax = presentation.terminalSizeClass === "compact" ? 24 : 32;
	const summaryMax =
		presentation.terminalSizeClass === "compact"
			? 40
			: presentation.terminalSizeClass === "wide"
				? 84
				: 60;
	const nameWidth = Math.min(
		nameMax,
		Math.max("Skill".length, ...items.map((item) => item.title.length)),
	);
	const scoreWidth = Math.max("Score".length, ...items.map((item) => String(item.score).length));
	return { nameWidth, scoreWidth, summaryWidth: summaryMax };
};

export const renderSkillsFindResultPanel = (
	state: WorkflowRunState,
	presentation: PresentationProfile,
) => {
	if (!state.outcome || state.outcome.kind === "failed") {
		return null;
	}

	const items = extractItems(state);
	if (items.length === 0) {
		return null;
	}

	const { nameWidth, scoreWidth, summaryWidth } = columnWidths(items, presentation);
	const header = `${truncateCell("Skill", nameWidth)}  ${truncateCell("Score", scoreWidth)}  Summary`;
	const divider = `${"-".repeat(nameWidth)}  ${"-".repeat(scoreWidth)}  ${"-".repeat(summaryWidth)}`;

	return (
		<Box flexDirection="column">
			<Text bold>Matching skills</Text>
			<Text>{header}</Text>
			<Text>{divider}</Text>
			{items.map((item) => (
				<Text key={item.id}>
					{truncateCell(item.title, nameWidth)} {truncateCell(String(item.score), scoreWidth)}{" "}
					{truncateCell(item.content, summaryWidth)}
				</Text>
			))}
		</Box>
	);
};
