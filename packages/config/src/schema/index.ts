import { z } from "zod";

export const MIMIRMESH_DIR = ".mimirmesh";
export const runtimeTimestampSchema = z.string().min(1);

export const runtimeStateSchema = z.enum(["bootstrapping", "ready", "degraded", "failed"]);
export const runtimeUpgradeStateSchema = z.enum([
	"current",
	"outdated",
	"repairable",
	"blocked",
	"degraded",
]);
export const runtimeUpgradeResultSchema = z.enum(["success", "degraded", "blocked", "failed"]);
export const runtimeUpgradeRequiredActionSchema = z.enum([
	"none",
	"restart-runtime",
	"migrate-state",
	"repair-state",
	"manual-intervention",
]);
export const runtimeUpgradeDriftCategorySchema = z.enum([
	"runtime-metadata",
	"compose-definition",
	"engine-image",
	"bootstrap-input",
	"preserved-asset-validation",
	"checkpoint-resume",
	"compatibility-window",
]);
export const runtimeMigrationKindSchema = z.enum([
	"metadata",
	"runtime-definition",
	"engine-state",
	"asset-classification",
	"discovery",
	"bootstrap",
	"validation",
]);
export const runtimeMigrationRollbackStrategySchema = z.enum([
	"rollback-step",
	"quarantine",
	"none",
]);
export const backupArtifactCategorySchema = z.enum([
	"config",
	"runtime-metadata",
	"engine-state",
	"routing",
	"bootstrap",
	"upgrade-metadata",
]);
export const preservedAssetTypeSchema = z.enum([
	"notes",
	"memory",
	"reports",
	"runtime-metadata",
	"engine-index",
	"engine-cache",
	"engine-state",
	"compose-runtime",
]);
export const preservedAssetCompatibilitySchema = z.enum([
	"compatible",
	"migrate",
	"rebuild",
	"blocked",
]);
export const preservedAssetValidationModeSchema = z.enum([
	"metadata",
	"presence",
	"live-check",
	"none",
]);
export const preservedAssetValidationResultSchema = z.enum([
	"passed",
	"failed",
	"skipped",
	"quarantined",
]);
export const engineUpgradeRuntimeActionSchema = z.enum([
	"none",
	"recreate-service",
	"restart-service",
	"rediscover-only",
	"rebootstrap",
]);

export const engineIdSchema = z.enum(["srclight", "document-mcp", "mcp-adr-analysis-server"]);

export const logLevelSchema = z.enum(["debug", "info", "warn", "error"]);
export const gpuModeSchema = z.enum(["auto", "on", "off"]);
export const mcpCompressionLevelSchema = z.enum(["minimal", "balanced", "aggressive"]);
export const mcpDeferredVisibilitySchema = z.enum(["summary", "hidden"]);
export const mcpRefreshPolicySchema = z.enum(["explicit", "automatic"]);
export const mcpRoutingHintOverrideEntrySchema = z.string().trim().min(1);

export const skillResolvePrecedenceStepSchema = z.enum([
	"alwaysLoad",
	"explicitName",
	"aliasOrTrigger",
	"lexical",
	"embeddings",
	"mcpEngineContext",
]);
export const skillReadModeSchema = z.enum(["memory", "instructions", "assets", "full"]);
export const skillReadProgressiveDisclosureSchema = z.enum(["strict"]);
export const skillCompressionAlgorithmSchema = z.enum(["zstd", "gzip"]);
export const skillCompressionProfileSchema = z.enum(["strict"]);
export const skillEmbeddingProviderTypeSchema = z.enum([
	"llama_cpp",
	"lm_studio",
	"openai",
	"openai_compatible_remote",
]);

const defaultSkillResolvePrecedence = [
	"alwaysLoad",
	"explicitName",
	"aliasOrTrigger",
	"lexical",
	"embeddings",
	"mcpEngineContext",
] as const;

const defaultSkillsConfig = {
	alwaysLoad: [] as string[],
	resolve: {
		precedence: [...defaultSkillResolvePrecedence],
		limit: 10,
	},
	read: {
		defaultMode: "memory" as const,
		progressiveDisclosure: "strict" as const,
	},
	cache: {
		negativeCache: {
			enabled: true,
			ttlSeconds: 900,
		},
	},
	compression: {
		enabled: true,
		algorithm: "zstd" as const,
		fallbackAlgorithm: "gzip" as const,
		profile: "strict" as const,
	},
	embeddings: {
		enabled: false,
		fallbackOnFailure: true,
		providers: [] as Array<{
			type: z.infer<typeof skillEmbeddingProviderTypeSchema>;
			model: string;
			baseUrl: string;
			apiKey?: string;
			timeoutMs: number;
			maxRetries: number;
		}>,
	},
} as const;

export const skillEmbeddingProviderSchema = z
	.object({
		type: skillEmbeddingProviderTypeSchema,
		model: z.string().min(1),
		baseUrl: z.string().min(1),
		apiKey: z.string().min(1).optional(),
		timeoutMs: z.number().int().positive().default(30_000),
		maxRetries: z.number().int().nonnegative().default(2),
	})
	.superRefine((value, context) => {
		if (
			(value.type === "openai" || value.type === "openai_compatible_remote") &&
			!value.apiKey?.trim()
		) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["apiKey"],
				message: `${value.type === "openai" ? "OpenAI" : "OpenAI-compatible remote"} providers require an apiKey value.`,
			});
		}
	});

export const skillsConfigSchema = z
	.object({
		alwaysLoad: z.array(z.string()).default(defaultSkillsConfig.alwaysLoad),
		resolve: z
			.object({
				precedence: z
					.array(skillResolvePrecedenceStepSchema)
					.default([...defaultSkillResolvePrecedence]),
				limit: z.number().int().positive().default(defaultSkillsConfig.resolve.limit),
			})
			.superRefine((value, context) => {
				if (new Set(value.precedence).size !== value.precedence.length) {
					context.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["precedence"],
						message: "Skill resolve precedence entries must be unique.",
					});
				}
			}),
		read: z.object({
			defaultMode: skillReadModeSchema.default(defaultSkillsConfig.read.defaultMode),
			progressiveDisclosure: skillReadProgressiveDisclosureSchema.default(
				defaultSkillsConfig.read.progressiveDisclosure,
			),
		}),
		cache: z.object({
			negativeCache: z.object({
				enabled: z.boolean().default(defaultSkillsConfig.cache.negativeCache.enabled),
				ttlSeconds: z
					.number()
					.int()
					.positive()
					.default(defaultSkillsConfig.cache.negativeCache.ttlSeconds),
			}),
		}),
		compression: z.object({
			enabled: z.boolean().default(defaultSkillsConfig.compression.enabled),
			algorithm: skillCompressionAlgorithmSchema.default(defaultSkillsConfig.compression.algorithm),
			fallbackAlgorithm: skillCompressionAlgorithmSchema.default(
				defaultSkillsConfig.compression.fallbackAlgorithm,
			),
			profile: skillCompressionProfileSchema.default(defaultSkillsConfig.compression.profile),
		}),
		embeddings: z
			.object({
				enabled: z.boolean().default(defaultSkillsConfig.embeddings.enabled),
				fallbackOnFailure: z.boolean().default(defaultSkillsConfig.embeddings.fallbackOnFailure),
				providers: z
					.array(skillEmbeddingProviderSchema)
					.default(defaultSkillsConfig.embeddings.providers),
			})
			.superRefine((value, context) => {
				if (value.enabled && value.providers.length === 0) {
					context.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["providers"],
						message: "Embeddings must define at least one provider when enabled.",
					});
				}

				const providerTypes = value.providers.map((provider) => provider.type);
				if (new Set(providerTypes).size !== providerTypes.length) {
					context.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["providers"],
						message: "Embedding provider types must be unique and deterministic.",
					});
				}
			}),
	})
	.superRefine((value, context) => {
		if (new Set(value.alwaysLoad).size !== value.alwaysLoad.length) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["alwaysLoad"],
				message: "Always-load skill names must be unique.",
			});
		}
	});

export const engineBridgeSchema = z.object({
	containerPort: z.number().int().positive().default(4701),
	healthPath: z.string().default("/health"),
	discoverPath: z.string().default("/discover"),
	callPath: z.string().default("/call"),
});

export const engineMountsSchema = z.object({
	repo: z.string().default("/workspace"),
	mimirmesh: z.string().default("/mimirmesh"),
	logs: z.string().default("/mimirmesh/logs"),
	indexes: z.string().default("/mimirmesh/indexes"),
	templates: z.string().default("/mimirmesh/templates"),
});

export const engineImageSchema = z.object({
	service: z.string(),
	dockerfile: z.string(),
	context: z.string(),
	tag: z.string(),
});

export const srclightSettingsSchema = z.object({
	transport: z.enum(["stdio", "sse"]).default("sse"),
	port: z.number().int().positive().default(8742),
	rootPath: z.string(),
	indexOnStart: z.boolean().default(true),
	embedModel: z.string().nullable().default(null),
	defaultEmbedModel: z.string().default("nomic-embed-text"),
	ollamaBaseUrl: z.string().nullable().default("http://host.docker.internal:11434"),
	embedRequestTimeoutSeconds: z.number().int().positive().default(20),
});

export const documentSettingsSchema = z.object({
	watchFolders: z.array(z.string()).default(["/workspace"]),
	lancedbPath: z.string().default("/mimirmesh/indexes/document-mcp"),
	llmModel: z.string().default("llama3.2:3b"),
	embeddingModel: z.string().default("all-MiniLM-L6-v2"),
	fileExtensions: z.array(z.string()).default([".pdf", ".docx", ".doc", ".txt", ".md", ".rtf"]),
	chunkSize: z.number().int().positive().default(1000),
	chunkOverlap: z.number().int().min(0).default(200),
	maxFileSizeMb: z.number().positive().default(100),
	ollamaBaseUrl: z.string().default("http://host.docker.internal:11434"),
	batchSize: z.number().int().positive().default(10),
});

export const adrSettingsSchema = z.object({
	projectPath: z.string().default("/workspace"),
	adrDirectory: z.string().default("docs/adr"),
	executionMode: z.enum(["full", "prompt-only"]).default("prompt-only"),
	openrouterApiKey: z.string().nullable(),
});

export const engineSettingsSchema = z.union([
	srclightSettingsSchema,
	documentSettingsSchema,
	adrSettingsSchema,
]);

export const engineConfigBaseSchema = z.object({
	enabled: z.boolean(),
	required: z.boolean().default(false),
	displayName: z.string(),
	namespace: z.string(),
	serviceName: z.string(),
	image: engineImageSchema,
	bridge: engineBridgeSchema,
	mounts: engineMountsSchema,
});

export const engineConfigSchema = engineConfigBaseSchema.extend({
	settings: engineSettingsSchema,
});

export const srclightEngineConfigSchema = engineConfigBaseSchema.extend({
	settings: srclightSettingsSchema,
});

export const documentEngineConfigSchema = engineConfigBaseSchema.extend({
	settings: documentSettingsSchema,
});

export const adrEngineConfigSchema = engineConfigBaseSchema.extend({
	settings: adrSettingsSchema,
});

export const runtimeConfigSchema = z.object({
	composeFile: z.string(),
	connectionFile: z.string(),
	healthFile: z.string(),
	routingTableFile: z.string(),
	bootstrapStateFile: z.string(),
	enginesStateDir: z.string(),
	projectName: z.string(),
	autoStart: z.boolean(),
	preferInternalNetwork: z.boolean(),
	useRandomPorts: z.boolean(),
	gpuMode: gpuModeSchema.default("auto"),
	state: runtimeStateSchema.default("failed"),
});

export const mcpToolSurfacePolicySchema = z
	.object({
		compressionLevel: mcpCompressionLevelSchema.default("balanced"),
		coreEngineGroups: z.array(engineIdSchema).default([]),
		deferredEngineGroups: z
			.array(engineIdSchema)
			.default(["srclight", "document-mcp", "mcp-adr-analysis-server"]),
		deferredVisibility: mcpDeferredVisibilitySchema.default("summary"),
		fullSchemaAccess: z.boolean().default(true),
		refreshPolicy: mcpRefreshPolicySchema.default("explicit"),
		allowInvocationLazyLoad: z.boolean().default(true),
	})
	.superRefine((value, context) => {
		for (const engine of value.coreEngineGroups) {
			if (value.deferredEngineGroups.includes(engine)) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["deferredEngineGroups"],
					message: `Engine group '${engine}' cannot be both core and deferred.`,
				});
			}
		}
	});

export const mcpRoutingHintsAdaptiveSubsetSchema = z
	.object({
		include: z.array(mcpRoutingHintOverrideEntrySchema).default([]),
		exclude: z.array(mcpRoutingHintOverrideEntrySchema).default([]),
	})
	.superRefine((value, context) => {
		if (new Set(value.include).size !== value.include.length) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["include"],
				message: "Adaptive subset include entries must be unique.",
			});
		}

		if (new Set(value.exclude).size !== value.exclude.length) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["exclude"],
				message: "Adaptive subset exclude entries must be unique.",
			});
		}
	});

export const mcpRoutingHintsSchema = z.object({
	adaptiveSubset: mcpRoutingHintsAdaptiveSubsetSchema.default({
		include: [],
		exclude: [],
	}),
});

export const mcpConfigSchema = z.object({
	toolSurface: mcpToolSurfacePolicySchema,
	routingHints: mcpRoutingHintsSchema.default({
		adaptiveSubset: {
			include: [],
			exclude: [],
		},
	}),
});

export const configSchema = z.object({
	version: z.literal(2),
	project: z.object({
		name: z.string(),
		rootPath: z.string(),
		initializedAt: z.string(),
	}),
	engines: z.object({
		srclight: srclightEngineConfigSchema,
		"document-mcp": documentEngineConfigSchema,
		"mcp-adr-analysis-server": adrEngineConfigSchema,
	}),
	skills: skillsConfigSchema,
	runtime: runtimeConfigSchema,
	logging: z.object({
		level: logLevelSchema,
		sessionLogging: z.boolean(),
		redactPatterns: z.array(z.string()),
	}),
	templates: z.object({
		overrideDir: z.string(),
		families: z.object({
			architecture: z.string(),
			feature: z.string(),
			runbook: z.string(),
			operationalNote: z.string(),
			decisionNote: z.string(),
			agentGuidance: z.string(),
		}),
	}),
	ide: z.object({
		targets: z.object({
			vscode: z.object({ installed: z.boolean(), configPath: z.string() }),
			cursor: z.object({ installed: z.boolean(), configPath: z.string() }),
			claude: z.object({ installed: z.boolean(), configPath: z.string() }),
			codex: z.object({ installed: z.boolean(), configPath: z.string() }),
		}),
	}),
	mcp: mcpConfigSchema,
	update: z.object({
		channel: z.enum(["stable", "beta", "nightly"]),
		autoCheck: z.boolean(),
	}),
	metadata: z.object({
		lastInitAt: z.string().nullable(),
		lastRefreshAt: z.string().nullable(),
		lastDoctorAt: z.string().nullable(),
		specKitExpected: z.boolean(),
	}),
});

export const globalConfigSchema = z.object({
	version: z.literal(1).default(1),
	skills: z.object({
		install: z.object({
			symbolic: z.boolean().default(true),
		}),
	}),
});

export const projectRuntimeVersionRecordSchema = z.object({
	runtimeVersion: z.string().min(1),
	schemaVersion: z.number().int().nonnegative(),
	lastUpgrade: runtimeTimestampSchema.nullable(),
	cliVersion: z.string().min(1),
	runtimeSchemaVersion: z.number().int().nonnegative(),
	engineDefinitionVersion: z.string().min(1),
	stateCompatibilityVersion: z.string().min(1),
	recordedAt: runtimeTimestampSchema,
	generatedBy: z.string().min(1),
});

export const backupArtifactSchema = z.object({
	path: z.string().min(1),
	backupPath: z.string().min(1),
	category: backupArtifactCategorySchema,
	createdAt: runtimeTimestampSchema,
	restorable: z.boolean(),
	restoredAt: runtimeTimestampSchema.nullable().default(null),
});

export const backupManifestSchema = z.object({
	upgradeId: z.string().min(1),
	root: z.string().min(1),
	createdAt: runtimeTimestampSchema,
	artifacts: z.array(backupArtifactSchema),
});

export const upgradeCheckpointSchema = z.object({
	upgradeId: z.string().min(1),
	targetVersion: projectRuntimeVersionRecordSchema,
	currentStepId: z.string().nullable().default(null),
	completedStepIds: z.array(z.string()),
	quarantinedStepIds: z.array(z.string()),
	lastAttemptAt: runtimeTimestampSchema,
	resumeAllowed: z.boolean(),
	failureReason: z.string().nullable().default(null),
});

export const preservedAssetRecordSchema = z.object({
	assetType: preservedAssetTypeSchema,
	location: z.string().min(1),
	compatibility: preservedAssetCompatibilitySchema,
	validationMode: preservedAssetValidationModeSchema,
	validationResult: preservedAssetValidationResultSchema,
	repairRequired: z.boolean(),
	details: z.string().min(1),
	quarantinePath: z.string().nullable().default(null),
	lastValidatedAt: runtimeTimestampSchema.nullable().default(null),
});

export const engineUpgradeDecisionSchema = z.object({
	engine: engineIdSchema,
	currentImageTag: z.string().nullable().default(null),
	targetImageTag: z.string().nullable().default(null),
	configHashChanged: z.boolean(),
	bootstrapInputChanged: z.boolean(),
	runtimeAction: engineUpgradeRuntimeActionSchema,
	assetImpact: z.string().min(1),
});

export const upgradeStatusReportSchema = z.object({
	state: runtimeUpgradeStateSchema,
	currentVersion: projectRuntimeVersionRecordSchema.nullable(),
	targetVersion: projectRuntimeVersionRecordSchema,
	automaticMigrationAllowed: z.boolean(),
	requiredActions: z.array(runtimeUpgradeRequiredActionSchema),
	driftCategories: z.array(runtimeUpgradeDriftCategorySchema),
	warnings: z.array(z.string()),
	checkedAt: runtimeTimestampSchema,
});

export const upgradeOutcomeSchema = z.object({
	result: runtimeUpgradeResultSchema,
	statusReport: upgradeStatusReportSchema,
	completedSteps: z.array(z.string()),
	restoredBackups: z.array(backupArtifactSchema),
	quarantinedAssets: z.array(preservedAssetRecordSchema),
	nextCommand: z.string().nullable().default(null),
	completedAt: runtimeTimestampSchema,
	resumedFromCheckpoint: z.boolean().default(false),
});

export const runtimeUpgradeMetadataSchema = z.object({
	version: projectRuntimeVersionRecordSchema,
	statusReport: upgradeStatusReportSchema.nullable().default(null),
	lastOutcome: upgradeOutcomeSchema.nullable().default(null),
	preservedAssets: z.array(preservedAssetRecordSchema).default([]),
	engineDecisions: z.array(engineUpgradeDecisionSchema).default([]),
	updatedAt: runtimeTimestampSchema,
	lastValidatedAt: runtimeTimestampSchema.nullable().default(null),
});

export type RuntimeState = z.infer<typeof runtimeStateSchema>;
export type EngineId = z.infer<typeof engineIdSchema>;
export type GpuMode = z.infer<typeof gpuModeSchema>;
export type McpCompressionLevel = z.infer<typeof mcpCompressionLevelSchema>;
export type McpDeferredVisibility = z.infer<typeof mcpDeferredVisibilitySchema>;
export type McpRefreshPolicy = z.infer<typeof mcpRefreshPolicySchema>;
export type McpRoutingHintOverrideEntry = z.infer<typeof mcpRoutingHintOverrideEntrySchema>;
export type SkillResolvePrecedenceStep = z.infer<typeof skillResolvePrecedenceStepSchema>;
export type SkillReadMode = z.infer<typeof skillReadModeSchema>;
export type SkillReadProgressiveDisclosure = z.infer<typeof skillReadProgressiveDisclosureSchema>;
export type SkillCompressionAlgorithm = z.infer<typeof skillCompressionAlgorithmSchema>;
export type SkillCompressionProfile = z.infer<typeof skillCompressionProfileSchema>;
export type SkillEmbeddingProviderType = z.infer<typeof skillEmbeddingProviderTypeSchema>;
export type SkillEmbeddingProvider = z.infer<typeof skillEmbeddingProviderSchema>;
export type SkillsConfig = z.infer<typeof skillsConfigSchema>;
export type EngineConfig = z.infer<typeof engineConfigSchema>;
export type McpToolSurfacePolicy = z.infer<typeof mcpToolSurfacePolicySchema>;
export type McpRoutingHintsAdaptiveSubset = z.infer<typeof mcpRoutingHintsAdaptiveSubsetSchema>;
export type McpRoutingHints = z.infer<typeof mcpRoutingHintsSchema>;
export type McpConfig = z.infer<typeof mcpConfigSchema>;
export type MimirmeshConfig = z.infer<typeof configSchema>;
export type MimirmeshGlobalConfig = z.infer<typeof globalConfigSchema>;
export type RuntimeUpgradeState = z.infer<typeof runtimeUpgradeStateSchema>;
export type RuntimeUpgradeResult = z.infer<typeof runtimeUpgradeResultSchema>;
export type RuntimeUpgradeRequiredAction = z.infer<typeof runtimeUpgradeRequiredActionSchema>;
export type RuntimeUpgradeDriftCategory = z.infer<typeof runtimeUpgradeDriftCategorySchema>;
export type RuntimeMigrationKind = z.infer<typeof runtimeMigrationKindSchema>;
export type RuntimeMigrationRollbackStrategy = z.infer<
	typeof runtimeMigrationRollbackStrategySchema
>;
export type BackupArtifactCategory = z.infer<typeof backupArtifactCategorySchema>;
export type PreservedAssetType = z.infer<typeof preservedAssetTypeSchema>;
export type PreservedAssetCompatibility = z.infer<typeof preservedAssetCompatibilitySchema>;
export type PreservedAssetValidationMode = z.infer<typeof preservedAssetValidationModeSchema>;
export type PreservedAssetValidationResult = z.infer<typeof preservedAssetValidationResultSchema>;
export type EngineUpgradeRuntimeAction = z.infer<typeof engineUpgradeRuntimeActionSchema>;
export type ProjectRuntimeVersionRecord = z.infer<typeof projectRuntimeVersionRecordSchema>;
export type BackupArtifact = z.infer<typeof backupArtifactSchema>;
export type BackupManifest = z.infer<typeof backupManifestSchema>;
export type UpgradeCheckpoint = z.infer<typeof upgradeCheckpointSchema>;
export type PreservedAssetRecord = z.infer<typeof preservedAssetRecordSchema>;
export type EngineUpgradeDecision = z.infer<typeof engineUpgradeDecisionSchema>;
export type UpgradeStatusReport = z.infer<typeof upgradeStatusReportSchema>;
export type UpgradeOutcome = z.infer<typeof upgradeOutcomeSchema>;
export type RuntimeUpgradeMetadata = z.infer<typeof runtimeUpgradeMetadataSchema>;

export type ConfigValidationResult = {
	ok: boolean;
	errors: string[];
	config?: MimirmeshConfig;
};

export type GlobalConfigValidationResult = {
	ok: boolean;
	errors: string[];
	config?: MimirmeshGlobalConfig;
};

export const validateConfigValue = (value: unknown): ConfigValidationResult => {
	const parsed = configSchema.safeParse(value);
	if (parsed.success) {
		return { ok: true, errors: [], config: parsed.data };
	}
	return {
		ok: false,
		errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
	};
};

export const validateGlobalConfigValue = (value: unknown): GlobalConfigValidationResult => {
	const parsed = globalConfigSchema.safeParse(value);
	if (parsed.success) {
		return { ok: true, errors: [], config: parsed.data };
	}

	return {
		ok: false,
		errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
	};
};
