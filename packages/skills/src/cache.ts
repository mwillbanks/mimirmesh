import { createHash } from "node:crypto";

import type { SkillReadRequest } from "./types";
import { descriptorSchemaVersion } from "./types";

const sortValue = (value: unknown): unknown => {
	if (Array.isArray(value)) {
		return value.map((entry) => sortValue(entry));
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, sortValue(entry)]),
		);
	}
	return value;
};

export const stableStringify = (value: unknown): string => JSON.stringify(sortValue(value));

export const hashDeterministic = (value: unknown): string =>
	createHash("sha256").update(stableStringify(value)).digest("hex");

export const buildRepoId = (projectRoot: string): string =>
	createHash("sha256").update(projectRoot.replaceAll("\\", "/")).digest("hex");

export const buildCacheKey = (repoId: string, name: string, contentHash: string): string =>
	hashDeterministic({
		repoId,
		name,
		descriptorSchemaVersion,
		contentHash,
	});

export const buildReadSignature = (request: SkillReadRequest): string =>
	hashDeterministic({
		name: request.name,
		mode: request.mode ?? "memory",
		include: request.include ?? [],
		select: request.select ?? {},
	});

export const createUuid = (): string => {
	const bunValue = (Bun as unknown as { randomUUIDv7?: () => string }).randomUUIDv7?.();
	return bunValue ?? crypto.randomUUID();
};
