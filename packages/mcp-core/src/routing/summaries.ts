import type { SanitizedArgumentSummary } from "@mimirmesh/runtime";
import { hashDeterministic } from "@mimirmesh/skills";
import type { ToolInput, UnifiedToolName } from "../types";

const firstText = (...values: unknown[]): string => {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}
	return "";
};

const identifierLikePattern = /^[A-Za-z_][A-Za-z0-9_.:$#-]*$/;

const promptLengthBand = (value: string): SanitizedArgumentSummary["promptLengthBand"] => {
	if (!value) {
		return "short";
	}
	if (value.length <= 40) {
		return "short";
	}
	if (value.length <= 200) {
		return "medium";
	}
	return "long";
};

const limitBand = (value: unknown): SanitizedArgumentSummary["limitBand"] => {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		return "default";
	}
	if (value <= 5) {
		return "small";
	}
	if (value <= 25) {
		return "medium";
	}
	return "large";
};

const queryClass = (query: string, hasPath: boolean): SanitizedArgumentSummary["queryClass"] => {
	if (!query && !hasPath) {
		return "empty";
	}
	if (!query && hasPath) {
		return "path-only";
	}
	if (identifierLikePattern.test(query)) {
		return hasPath ? "mixed" : "identifier";
	}
	if (hasPath) {
		return "mixed";
	}
	return "free-text";
};

export const summarizeToolInput = (
	_tool: UnifiedToolName,
	input: ToolInput,
): SanitizedArgumentSummary => {
	const query = firstText(
		input.query,
		input.symbol,
		input.name,
		input.identifier,
		input.context,
		input.prompt,
	);
	const path = firstText(input.path, input.filePath, input.file_path, input.uri);
	const hasPath = Boolean(path);
	return {
		shapeVersion: 1,
		queryClass: queryClass(query, hasPath),
		hasPath,
		limitBand: limitBand(input.limit ?? input.max_results),
		promptLengthBand: promptLengthBand(query),
		identifierLike: Boolean(query) && identifierLikePattern.test(query),
		additionalFlags: {
			hasContext: Boolean(firstText(input.context)),
			hasKind: Boolean(firstText(input.kind)),
			hasScope: Boolean(firstText(input.scope)),
			hasEnvironment: Boolean(firstText(input.environment)),
		},
	};
};

export const buildRouteProfileKey = (
	unifiedTool: UnifiedToolName,
	summary: SanitizedArgumentSummary,
): string =>
	hashDeterministic({
		unifiedTool,
		summary,
	});

export const buildRouteRequestFingerprint = (
	unifiedTool: UnifiedToolName,
	summary: SanitizedArgumentSummary,
): string =>
	hashDeterministic({
		unifiedTool,
		summary,
		fingerprint: true,
	});
