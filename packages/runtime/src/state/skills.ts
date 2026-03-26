import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
	type MimirmeshConfig,
	runtimeStateSchema,
	runtimeTimestampSchema,
	type SkillEmbeddingProviderType,
	skillEmbeddingProviderTypeSchema,
} from "@mimirmesh/config";
import { z } from "zod";

import { skillRegistryStatePath } from "./paths";

export { skillRegistryStatePath };

export const normalizedSkillEmbeddingProviderSchema = z.object({
	type: skillEmbeddingProviderTypeSchema,
	model: z.string().min(1),
	baseUrl: z.string().min(1),
	timeoutMs: z.number().int().positive(),
	maxRetries: z.number().int().nonnegative(),
	apiKeyConfigured: z.boolean(),
});

export const skillProviderSelectionSchema = z.object({
	enabled: z.boolean(),
	readiness: z.enum(["ready", "degraded"]),
	reasons: z.array(z.string()).default([]),
	providers: z.array(normalizedSkillEmbeddingProviderSchema).default([]),
	selectedProviderIndex: z.number().int().nullable().default(null),
	selectedProviderType: skillEmbeddingProviderTypeSchema.nullable().default(null),
	localRuntime: z
		.object({
			serviceName: z.string().min(1),
			image: z.string().min(1),
			baseImage: z.string().min(1),
			variant: z.enum(["server", "server-cuda"]),
			buildContext: z.string().min(1),
			dockerfile: z.string().min(1),
			modelStoragePath: z.string().min(1),
			healthPath: z.string().min(1),
			port: z.number().int().positive(),
		})
		.nullable()
		.default(null),
});

export const skillRegistryBootstrapStateSchema = z.object({
	state: runtimeStateSchema,
	checkedAt: runtimeTimestampSchema,
	hostGpuAvailable: z.boolean(),
	reasons: z.array(z.string()).default([]),
});

export const skillRegistryReadinessStateSchema = z.object({
	state: runtimeStateSchema,
	checkedAt: runtimeTimestampSchema,
	statePath: z.string().min(1),
	configHash: z.string().min(1),
	embeddingsEnabled: z.boolean(),
	providerCount: z.number().int().nonnegative(),
	reasons: z.array(z.string()).default([]),
});

const skillCompressionRecordSchema = z.object({
	algorithm: z.enum(["zstd", "gzip", "none"]),
	scope: z.enum(["transport", "at-rest", "export"]),
	sizeBytes: z.number().int().nonnegative(),
});

const skillSourceSchema = z.object({
	rootPath: z.string().min(1),
	skillPath: z.string().min(1),
	provider: z.enum(["repository", "bundled"]),
	revision: z.string().nullable().optional(),
});

const skillSectionSchema = z.object({
	id: z.string().min(1),
	skillId: z.string().min(1),
	ordinal: z.number().int().nonnegative(),
	kind: z.enum(["instructions", "example", "reference_hint", "compatibility", "other"]),
	headingPath: z.array(z.string()),
	text: z.string(),
	tokenEstimate: z.number().int().nonnegative(),
	sectionHash: z.string().min(1),
});

const skillAssetSchema = z.object({
	id: z.string().min(1),
	skillId: z.string().min(1),
	path: z.string().min(1),
	assetType: z.enum(["reference", "script", "template", "example", "auxiliary"]),
	mediaType: z.string().nullable(),
	textContent: z.string().nullable(),
	blobRef: z.string().nullable().optional(),
	compression: skillCompressionRecordSchema.nullable().optional(),
	contentHash: z.string().min(1),
	tokenEstimate: z.number().int().nonnegative(),
});

const skillRecordSchema = z.object({
	id: z.string().min(1),
	repoId: z.string().min(1),
	name: z.string().min(1),
	description: z.string(),
	license: z.string().optional(),
	compatibility: z.string().nullable().optional(),
	metadata: z.record(z.string(), z.unknown()),
	source: skillSourceSchema,
	rawMarkdown: z.string(),
	frontmatterSource: z.string(),
	bodyMarkdown: z.string(),
	contentHash: z.string().min(1),
	schemaVersion: z.string().min(1),
	parseWarnings: z.array(z.string()).default([]),
	rawCompression: skillCompressionRecordSchema.nullable().optional(),
	normalizedCompression: skillCompressionRecordSchema.nullable().optional(),
	discoveredAt: runtimeTimestampSchema,
	indexedAt: runtimeTimestampSchema,
	updatedAt: runtimeTimestampSchema,
	sections: z.array(skillSectionSchema).default([]),
	assets: z.array(skillAssetSchema).default([]),
});

const skillRegistryCacheEntrySchema = z.object({
	repoId: z.string().min(1),
	lookupKey: z.string().min(1),
	skillName: z.string().min(1),
	contentHash: z.string().min(1),
	readSignature: z.string().min(1),
	payload: z.record(z.string(), z.unknown()),
	createdAt: runtimeTimestampSchema,
});

const skillRegistryNegativeCacheEntrySchema = z.object({
	repoId: z.string().min(1),
	lookupKey: z.string().min(1),
	createdAt: runtimeTimestampSchema,
	expiresAt: runtimeTimestampSchema,
});

const skillEmbeddingEntrySchema = z.object({
	skillId: z.string().min(1),
	targetType: z.enum(["skill", "section", "summary"]),
	model: z.string().min(1),
	dims: z.number().int().nonnegative(),
	embeddingHash: z.string().min(1),
	providerType: skillEmbeddingProviderTypeSchema,
	createdAt: runtimeTimestampSchema,
	vector: z.array(z.number()).optional(),
});

export const skillRegistryStateSchema = z.object({
	projectRoot: z.string().min(1),
	updatedAt: runtimeTimestampSchema,
	configHash: z.string().min(1),
	bootstrap: skillRegistryBootstrapStateSchema,
	readiness: skillRegistryReadinessStateSchema,
	providerSelection: skillProviderSelectionSchema,
	skills: z.array(skillRecordSchema).default([]),
	positiveCache: z.array(skillRegistryCacheEntrySchema).default([]),
	negativeCache: z.array(skillRegistryNegativeCacheEntrySchema).default([]),
	embeddings: z.array(skillEmbeddingEntrySchema).default([]),
	lastIndexedAt: runtimeTimestampSchema.nullable().default(null),
});

export type SkillProviderSelection = z.infer<typeof skillProviderSelectionSchema>;
export type SkillRegistryBootstrapState = z.infer<typeof skillRegistryBootstrapStateSchema>;
export type SkillRegistryReadinessState = z.infer<typeof skillRegistryReadinessStateSchema>;
export type SkillRegistryState = z.infer<typeof skillRegistryStateSchema>;
export type PersistedSkillRecord = z.infer<typeof skillRecordSchema>;
export type SkillRegistryCacheEntry = z.infer<typeof skillRegistryCacheEntrySchema>;
export type SkillRegistryNegativeCacheEntry = z.infer<typeof skillRegistryNegativeCacheEntrySchema>;
export type SkillEmbeddingEntry = z.infer<typeof skillEmbeddingEntrySchema>;

const writeJson = async (path: string, value: unknown): Promise<void> => {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const readJsonWithSchema = async <T>(path: string, schema: z.ZodType<T>): Promise<T | null> => {
	try {
		const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
		const validated = schema.safeParse(parsed);
		return validated.success ? validated.data : null;
	} catch {
		return null;
	}
};

export const persistSkillRegistryState = async (
	projectRoot: string,
	state: SkillRegistryState,
): Promise<void> => {
	await writeJson(skillRegistryStatePath(projectRoot), state);
};

export const loadSkillRegistryState = async (
	projectRoot: string,
): Promise<SkillRegistryState | null> =>
	readJsonWithSchema(skillRegistryStatePath(projectRoot), skillRegistryStateSchema);

export const normalizeEmbeddingProviders = (
	providers: MimirmeshConfig["skills"]["embeddings"]["providers"],
): SkillProviderSelection["providers"] =>
	providers.map((provider) => ({
		type: provider.type,
		model: provider.model,
		baseUrl: provider.baseUrl,
		timeoutMs: provider.timeoutMs,
		maxRetries: provider.maxRetries,
		apiKeyConfigured: typeof provider.apiKey === "string" && provider.apiKey.trim().length > 0,
	}));

export type NormalizedSkillEmbeddingProvider = SkillProviderSelection["providers"][number];
export type SkillEmbeddingProviderVariant = SkillEmbeddingProviderType;
