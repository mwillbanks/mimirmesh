import type { ToolResultItem } from "../types";

const fingerprint = (item: ToolResultItem): string =>
	`${item.title.toLowerCase()}::${item.content.toLowerCase().slice(0, 180)}`;

export const deduplicateAndRank = (items: ToolResultItem[]): ToolResultItem[] => {
	const seen = new Set<string>();
	const deduped: ToolResultItem[] = [];

	for (const item of items) {
		const key = fingerprint(item);
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		deduped.push(item);
	}

	return deduped.sort((left, right) => right.score - left.score);
};
