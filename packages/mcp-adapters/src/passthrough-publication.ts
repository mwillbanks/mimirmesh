const isNormalizedToolCharacter = (character: string): boolean => {
	const code = character.charCodeAt(0);
	return (
		(code >= 97 && code <= 122) ||
		(code >= 48 && code <= 57) ||
		character === "_" ||
		character === "-"
	);
};

const normalizePassthroughToolSegment = (tool: string): string => {
	const normalized = tool.trim().toLowerCase();
	const characters: string[] = [];
	let pendingSeparator = false;

	for (const character of normalized) {
		if (isNormalizedToolCharacter(character)) {
			if (pendingSeparator && characters.length > 0) {
				characters.push("_");
			}
			characters.push(character);
			pendingSeparator = false;
			continue;
		}

		pendingSeparator = characters.length > 0;
	}

	let start = 0;
	let end = characters.length;

	while (start < end && characters[start] === "_") {
		start += 1;
	}

	while (end > start && characters[end - 1] === "_") {
		end -= 1;
	}

	return characters.slice(start, end).join("") || "tool";
};

export const buildLegacyPassthroughToolName = (namespace: string, tool: string): string =>
	`${namespace}.${normalizePassthroughToolSegment(tool)}`;

export const buildPublishedPassthroughToolName = (canonicalId: string, tool: string): string =>
	`${canonicalId}_${normalizePassthroughToolSegment(tool)}`;

export const buildTransportToolName = (toolName: string): string =>
	toolName.replaceAll(".", "_").replaceAll("/", "_");
