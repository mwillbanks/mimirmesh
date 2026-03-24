import type { EngineId, MimirmeshConfig } from "../schema";

const splitPath = (path: string): string[] =>
	path
		.split(".")
		.map((part) => part.trim())
		.filter(Boolean);

const forbiddenSegments = new Set(["__proto__", "prototype", "constructor"]);

const assertSafeConfigPath = (segments: string[]): void => {
	for (const segment of segments) {
		if (forbiddenSegments.has(segment)) {
			throw new Error(`Config path segment '${segment}' is not allowed.`);
		}
	}
};

export const getConfigValue = (config: MimirmeshConfig, path: string): unknown => {
	if (!path) {
		return config;
	}
	const segments = splitPath(path);
	assertSafeConfigPath(segments);
	let cursor: unknown = config;
	for (const segment of segments) {
		if (
			typeof cursor !== "object" ||
			cursor === null ||
			!Object.hasOwn(cursor as Record<string, unknown>, segment)
		) {
			return undefined;
		}
		cursor = (cursor as Record<string, unknown>)[segment];
	}
	return cursor;
};

export const setConfigValue = (
	config: MimirmeshConfig,
	path: string,
	value: unknown,
): MimirmeshConfig => {
	const segments = splitPath(path);
	if (segments.length === 0) {
		throw new Error("Config path must not be empty.");
	}
	assertSafeConfigPath(segments);

	const clone = structuredClone(config) as Record<string, unknown>;
	let cursor = clone;

	for (const segment of segments.slice(0, -1)) {
		const next = cursor[segment];
		if (typeof next !== "object" || next === null || Array.isArray(next)) {
			cursor[segment] = {};
		}
		cursor = cursor[segment] as Record<string, unknown>;
	}

	cursor[segments.at(-1) as string] = value;
	return clone as MimirmeshConfig;
};

export const enableEngine = (config: MimirmeshConfig, engine: EngineId): MimirmeshConfig => {
	const next = structuredClone(config);
	next.engines[engine].enabled = true;
	return next;
};

export const disableEngine = (config: MimirmeshConfig, engine: EngineId): MimirmeshConfig => {
	const next = structuredClone(config);
	next.engines[engine].enabled = false;
	return next;
};

export const listEnabledEngines = (config: MimirmeshConfig): EngineId[] => {
	return Object.entries(config.engines)
		.filter(([, value]) => value.enabled)
		.map(([id]) => id as EngineId);
};

export const parseConfigPrimitive = (value: string): unknown => {
	const trimmed = value.trim();
	if (trimmed === "true") {
		return true;
	}
	if (trimmed === "false") {
		return false;
	}
	if (trimmed === "null") {
		return null;
	}
	if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
		return Number(trimmed);
	}

	try {
		return JSON.parse(trimmed) as unknown;
	} catch {
		return value;
	}
};
